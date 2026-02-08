import { createClient } from '@supabase/supabase-js';
import type { ComponentVersion, AuditAction, BumpType, Project, LibraryVersion, LibraryVersionComponent, LibraryChangelogEntry } from './types';

const SUPABASE_URL = 'https://nwweqcjiklzmlmvbfjkt.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im53d2VxY2ppa2x6bWxtdmJmamt0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0MTMwNDgsImV4cCI6MjA4NTk4OTA0OH0.G8P90aYwynGDfEgvCNfmOqY5IlE5ppVn6Vgb_e7b56w';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- Slack Notification (fire-and-forget) ---

function notifySlack(params: {
  type: 'component' | 'library';
  componentName: string;
  version: string;
  bumpType: string;
  message: string;
  userName: string;
}) {
  supabase.functions.invoke('slack-notify', { body: params }).catch(() => {});
}

// --- Projects ---

export async function getOrCreateProject(name: string, figmaFileKey: string): Promise<Project> {
  // Try to find existing project by file key (limit 1 to handle duplicates)
  const { data: existing } = await supabase
    .from('projects')
    .select('*')
    .eq('figma_file_key', figmaFileKey)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (existing) return existing as Project;

  // Create new project
  const { data, error } = await supabase
    .from('projects')
    .insert({ name, figma_file_key: figmaFileKey })
    .select()
    .single();

  if (error) throw new Error(`Failed to create project: ${error.message}`);
  return data as Project;
}

// --- Component Versions ---

export async function createDraft(params: {
  projectId: string;
  componentKey: string;
  componentName: string;
  snapshot: any;
  propertyDefinitions: any;
  variablesUsed: any;
  diff: any | null;
  createdBy: string;
  photoUrl?: string;
}): Promise<ComponentVersion> {
  // Check for existing active draft — update it instead of creating duplicate
  const existing = await getActiveDraft(params.componentKey, params.projectId);

  if (existing && (existing.status === 'draft' || existing.status === 'in_review')) {
    const { data, error } = await supabase
      .from('component_versions')
      .update({
        snapshot: params.snapshot,
        property_definitions: params.propertyDefinitions,
        variables_used: params.variablesUsed,
        diff: params.diff,
        status: 'draft',
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
      .select()
      .single();

    if (error) throw new Error(`Failed to update draft: ${error.message}`);
    await logAudit(data.id, 'created', params.createdBy, 'Updated draft with fresh snapshot', params.photoUrl);
    return data as ComponentVersion;
  }

  // Create new draft with placeholder version
  const { data, error } = await supabase
    .from('component_versions')
    .insert({
      project_id: params.projectId,
      component_key: params.componentKey,
      component_name: params.componentName,
      version: 'draft',
      status: 'draft',
      snapshot: params.snapshot,
      property_definitions: params.propertyDefinitions,
      variables_used: params.variablesUsed,
      diff: params.diff,
      created_by: params.createdBy,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create draft: ${error.message}`);

  await logAudit(data.id, 'created', params.createdBy, undefined, params.photoUrl);
  return data as ComponentVersion;
}

export async function submitForReview(versionId: string, userId: string, photoUrl?: string): Promise<void> {
  const { error } = await supabase
    .from('component_versions')
    .update({ status: 'in_review', updated_at: new Date().toISOString() })
    .eq('id', versionId);

  if (error) throw new Error(`Failed to submit for review: ${error.message}`);
  await logAudit(versionId, 'submitted_for_review', userId, undefined, photoUrl);
}

export async function approveVersion(versionId: string, reviewerId: string, photoUrl?: string): Promise<void> {
  const { error } = await supabase
    .from('component_versions')
    .update({
      status: 'approved',
      reviewed_by: reviewerId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', versionId);

  if (error) throw new Error(`Failed to approve: ${error.message}`);
  await logAudit(versionId, 'approved', reviewerId, undefined, photoUrl);
}

export async function rejectVersion(versionId: string, reviewerId: string, note?: string, photoUrl?: string): Promise<void> {
  const { error } = await supabase
    .from('component_versions')
    .update({
      status: 'draft',
      reviewed_by: reviewerId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', versionId);

  if (error) throw new Error(`Failed to reject: ${error.message}`);
  await logAudit(versionId, 'rejected', reviewerId, note, photoUrl);
}

export async function publishVersion(
  versionId: string,
  bumpType: BumpType,
  message: string,
  userId: string,
  photoUrl?: string
): Promise<ComponentVersion> {
  // Get the version to compute the new semver
  const { data: version } = await supabase
    .from('component_versions')
    .select('*, projects(*)')
    .eq('id', versionId)
    .single();

  if (!version) throw new Error('Version not found');

  const latest = await getLatestPublished(version.component_key, version.project_id);
  const newVersion = computeVersion(latest?.version || '0.0.0', bumpType);

  // Deprecate previous published version(s) for this component
  if (latest) {
    await supabase
      .from('component_versions')
      .update({ status: 'deprecated', updated_at: new Date().toISOString() })
      .eq('component_key', version.component_key)
      .eq('project_id', version.project_id)
      .eq('status', 'published');
  }

  const { data, error } = await supabase
    .from('component_versions')
    .update({
      status: 'published',
      version: newVersion,
      bump_type: bumpType,
      changelog_message: message,
      published_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', versionId)
    .select()
    .single();

  if (error) throw new Error(`Failed to publish: ${error.message}`);
  await logAudit(versionId, 'published', userId, `Published as ${newVersion}`, photoUrl);
  notifySlack({
    type: 'component',
    componentName: version.component_name,
    version: newVersion,
    bumpType: bumpType,
    message,
    userName: userId,
  });
  return data as ComponentVersion;
}

// --- Queries ---

export async function getVersionHistory(
  componentKey: string,
  projectId: string
): Promise<ComponentVersion[]> {
  const { data, error } = await supabase
    .from('component_versions')
    .select('*')
    .eq('component_key', componentKey)
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Failed to get history: ${error.message}`);
  return (data || []) as ComponentVersion[];
}

export async function getLatestPublished(
  componentKey: string,
  projectId: string
): Promise<ComponentVersion | null> {
  const { data } = await supabase
    .from('component_versions')
    .select('*')
    .eq('component_key', componentKey)
    .eq('project_id', projectId)
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return (data as ComponentVersion) || null;
}

export async function getActiveDraft(
  componentKey: string,
  projectId: string
): Promise<ComponentVersion | null> {
  const { data } = await supabase
    .from('component_versions')
    .select('*')
    .eq('component_key', componentKey)
    .eq('project_id', projectId)
    .in('status', ['draft', 'in_review', 'approved'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return (data as ComponentVersion) || null;
}

// Batch fetch all version statuses for a project in one query
export async function getProjectVersionMaps(
  projectId: string
): Promise<{
  versionMap: Record<string, ComponentVersion | null>;
  draftMap: Record<string, ComponentVersion | null>;
}> {
  const { data } = await supabase
    .from('component_versions')
    .select('id, project_id, component_key, component_name, version, status, thumbnail_url, changelog_message, bump_type, created_by, reviewed_by, published_at, created_at, updated_at')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });

  const versions = (data as ComponentVersion[]) || [];
  const versionMap: Record<string, ComponentVersion | null> = {};
  const draftMap: Record<string, ComponentVersion | null> = {};

  for (const v of versions) {
    // Latest published per component
    if (v.status === 'published' && !versionMap[v.component_key]) {
      versionMap[v.component_key] = v;
    }
    // Latest active draft per component
    if (['draft', 'in_review', 'approved'].includes(v.status) && !draftMap[v.component_key]) {
      draftMap[v.component_key] = v;
    }
  }

  return { versionMap, draftMap };
}

export async function getVersionById(versionId: string): Promise<ComponentVersion | null> {
  const { data } = await supabase
    .from('component_versions')
    .select('*')
    .eq('id', versionId)
    .single();

  return (data as ComponentVersion) || null;
}

// --- Delete Draft ---

export async function deleteDraft(versionId: string): Promise<void> {
  // Delete audit log entries first (foreign key)
  await supabase
    .from('audit_log')
    .delete()
    .eq('component_version_id', versionId);

  const { error } = await supabase
    .from('component_versions')
    .delete()
    .eq('id', versionId);

  if (error) throw new Error(`Failed to delete draft: ${error.message}`);
}

// --- Thumbnails ---

export async function uploadThumbnail(
  bytes: Uint8Array,
  path: string
): Promise<string> {
  const { error } = await supabase.storage
    .from('thumbnails')
    .upload(path, bytes, { contentType: 'image/png', upsert: true });

  if (error) throw new Error(`Failed to upload thumbnail: ${error.message}`);

  const { data } = supabase.storage.from('thumbnails').getPublicUrl(path);
  return data.publicUrl;
}

// --- Audit Log ---

export async function logAudit(
  versionId: string,
  action: AuditAction,
  userId: string,
  note?: string,
  photoUrl?: string
): Promise<void> {
  const { error } = await supabase
    .from('audit_log')
    .insert({
      component_version_id: versionId,
      action,
      performed_by: userId,
      note: note || null,
      performer_photo_url: photoUrl || null,
    });

  if (error) console.error('Audit log failed:', error.message);
}

export async function getAuditLog(versionId: string) {
  const { data, error } = await supabase
    .from('audit_log')
    .select('*')
    .eq('component_version_id', versionId)
    .order('created_at', { ascending: true });

  if (error) throw new Error(`Failed to get audit log: ${error.message}`);
  return data || [];
}

// --- Figma Token Management ---

export async function getStoredToken(figmaUserId: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_at: string;
} | null> {
  const { data } = await supabase
    .from('figma_tokens')
    .select('access_token, refresh_token, expires_at')
    .eq('figma_user_id', figmaUserId)
    .maybeSingle();

  return data;
}

export async function refreshFigmaToken(figmaUserId: string): Promise<string | null> {
  const stored = await getStoredToken(figmaUserId);
  if (!stored) return null;

  // Call Figma token refresh endpoint via our edge function would be complex;
  // for now we just check if the token is still valid
  const isExpired = new Date(stored.expires_at) < new Date();
  if (!isExpired) return stored.access_token;

  // Token is expired — user needs to re-authenticate
  return null;
}

// --- Library Versions ---

export async function getLatestLibraryVersion(projectId: string): Promise<LibraryVersion | null> {
  const { data } = await supabase
    .from('library_versions')
    .select('*')
    .eq('project_id', projectId)
    .order('published_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return (data as LibraryVersion) || null;
}

export async function getLibraryVersionHistory(projectId: string): Promise<LibraryVersion[]> {
  const { data, error } = await supabase
    .from('library_versions')
    .select('*')
    .eq('project_id', projectId)
    .order('published_at', { ascending: false });

  if (error) throw new Error(`Failed to get library version history: ${error.message}`);
  return (data || []) as LibraryVersion[];
}

export async function getLibraryVersionComponents(
  libraryVersionId: string
): Promise<LibraryVersionComponent[]> {
  const { data, error } = await supabase
    .from('library_version_components')
    .select('*')
    .eq('library_version_id', libraryVersionId);

  if (error) throw new Error(`Failed to get library version components: ${error.message}`);
  return (data || []) as LibraryVersionComponent[];
}

export async function computeLibraryChangelog(
  projectId: string
): Promise<LibraryChangelogEntry[]> {
  // Get all currently published component versions for this project
  const { data: published } = await supabase
    .from('component_versions')
    .select('id, component_key, component_name, version, bump_type, changelog_message')
    .eq('project_id', projectId)
    .eq('status', 'published');

  const currentComponents = (published || []) as ComponentVersion[];

  // Get the latest library release and its components
  const latestRelease = await getLatestLibraryVersion(projectId);

  if (!latestRelease) {
    // No previous release — all published components are "added"
    return currentComponents.map(c => ({
      component_key: c.component_key,
      component_name: c.component_name,
      change_type: 'added' as const,
      to_version: c.version,
      bump_type: c.bump_type || undefined,
      changelog_message: c.changelog_message || undefined,
    }));
  }

  const previousComponents = await getLibraryVersionComponents(latestRelease.id);

  // Build lookup maps
  const prevMap = new Map(previousComponents.map(c => [c.component_key, c]));
  const currMap = new Map(currentComponents.map(c => [c.component_key, c]));

  const entries: LibraryChangelogEntry[] = [];

  // Check current components against previous release
  for (const curr of currentComponents) {
    const prev = prevMap.get(curr.component_key);
    if (!prev) {
      // New component
      entries.push({
        component_key: curr.component_key,
        component_name: curr.component_name,
        change_type: 'added',
        to_version: curr.version,
        bump_type: curr.bump_type || undefined,
        changelog_message: curr.changelog_message || undefined,
      });
    } else if (prev.component_version_id !== curr.id) {
      // Updated component (different version id)
      entries.push({
        component_key: curr.component_key,
        component_name: curr.component_name,
        change_type: 'updated',
        from_version: undefined, // We'll resolve this below
        to_version: curr.version,
        bump_type: curr.bump_type || undefined,
        changelog_message: curr.changelog_message || undefined,
      });
    }
    // Same version id = unchanged, skip
  }

  // Check for removed components
  for (const prev of previousComponents) {
    if (!currMap.has(prev.component_key)) {
      entries.push({
        component_key: prev.component_key,
        component_name: prev.component_name,
        change_type: 'removed',
      });
    }
  }

  // Resolve from_version for updated entries by fetching the old component versions
  const updatedEntries = entries.filter(e => e.change_type === 'updated');
  if (updatedEntries.length > 0) {
    const oldVersionIds = updatedEntries.map(e => {
      const prev = prevMap.get(e.component_key)!;
      return prev.component_version_id;
    });
    const { data: oldVersions } = await supabase
      .from('component_versions')
      .select('id, version')
      .in('id', oldVersionIds);

    const oldVerMap = new Map((oldVersions || []).map((v: any) => [v.id, v.version]));
    for (const entry of updatedEntries) {
      const prev = prevMap.get(entry.component_key)!;
      entry.from_version = oldVerMap.get(prev.component_version_id);
    }
  }

  // Sort: added first, then updated, then removed
  const order = { added: 0, updated: 1, removed: 2 };
  entries.sort((a, b) => order[a.change_type] - order[b.change_type]);

  return entries;
}

export async function publishLibraryVersion(
  projectId: string,
  bumpType: BumpType,
  message: string,
  userId: string
): Promise<LibraryVersion> {
  // Get the latest library version to compute next semver
  const latest = await getLatestLibraryVersion(projectId);
  const newVersion = computeVersion(latest?.version || '0.0.0', bumpType);

  // Create the library version row
  const { data: libVersion, error: libError } = await supabase
    .from('library_versions')
    .insert({
      project_id: projectId,
      version: newVersion,
      bump_type: bumpType,
      changelog_message: message || null,
      published_by: userId,
      published_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (libError) throw new Error(`Failed to create library version: ${libError.message}`);

  // Get all currently published component versions
  const { data: published } = await supabase
    .from('component_versions')
    .select('id, component_key, component_name')
    .eq('project_id', projectId)
    .eq('status', 'published');

  const components = (published || []) as ComponentVersion[];

  // Insert junction rows
  if (components.length > 0) {
    const junctionRows = components.map(c => ({
      library_version_id: libVersion.id,
      component_version_id: c.id,
      component_key: c.component_key,
      component_name: c.component_name,
    }));

    const { error: junctionError } = await supabase
      .from('library_version_components')
      .insert(junctionRows);

    if (junctionError) throw new Error(`Failed to link components: ${junctionError.message}`);
  }

  notifySlack({
    type: 'library',
    componentName: 'Library',
    version: newVersion,
    bumpType: bumpType,
    message: message || '',
    userName: userId,
  });

  return libVersion as LibraryVersion;
}

export async function getLibraryVersionChangelog(
  libraryVersionId: string,
  projectId: string
): Promise<LibraryChangelogEntry[]> {
  // Get this release's components
  const thisComponents = await getLibraryVersionComponents(libraryVersionId);

  // Get all library versions to find the predecessor
  const allVersions = await getLibraryVersionHistory(projectId);
  const thisIdx = allVersions.findIndex(v => v.id === libraryVersionId);
  const prevRelease = thisIdx >= 0 && thisIdx < allVersions.length - 1
    ? allVersions[thisIdx + 1]
    : null;

  if (!prevRelease) {
    // First release — everything is "added"
    // Fetch component versions to get version numbers
    const versionIds = thisComponents.map(c => c.component_version_id);
    const { data: versions } = await supabase
      .from('component_versions')
      .select('id, version, bump_type, changelog_message')
      .in('id', versionIds);

    const verMap = new Map((versions || []).map((v: any) => [v.id, v]));
    return thisComponents.map(c => {
      const ver = verMap.get(c.component_version_id);
      return {
        component_key: c.component_key,
        component_name: c.component_name,
        change_type: 'added' as const,
        to_version: ver?.version,
        bump_type: ver?.bump_type || undefined,
        changelog_message: ver?.changelog_message || undefined,
      };
    });
  }

  const prevComponents = await getLibraryVersionComponents(prevRelease.id);

  // Build lookup maps
  const prevMap = new Map(prevComponents.map(c => [c.component_key, c]));
  const thisMap = new Map(thisComponents.map(c => [c.component_key, c]));

  const entries: LibraryChangelogEntry[] = [];

  // Collect all component_version_ids we need to look up
  const versionIdsToFetch = new Set<string>();
  for (const curr of thisComponents) versionIdsToFetch.add(curr.component_version_id);
  for (const prev of prevComponents) versionIdsToFetch.add(prev.component_version_id);

  const { data: allVersionData } = await supabase
    .from('component_versions')
    .select('id, version, bump_type, changelog_message')
    .in('id', [...versionIdsToFetch]);

  const verMap = new Map((allVersionData || []).map((v: any) => [v.id, v]));

  // Added and updated
  for (const curr of thisComponents) {
    const prev = prevMap.get(curr.component_key);
    const currVer = verMap.get(curr.component_version_id);

    if (!prev) {
      entries.push({
        component_key: curr.component_key,
        component_name: curr.component_name,
        change_type: 'added',
        to_version: currVer?.version,
        bump_type: currVer?.bump_type || undefined,
        changelog_message: currVer?.changelog_message || undefined,
      });
    } else if (prev.component_version_id !== curr.component_version_id) {
      const prevVer = verMap.get(prev.component_version_id);
      entries.push({
        component_key: curr.component_key,
        component_name: curr.component_name,
        change_type: 'updated',
        from_version: prevVer?.version,
        to_version: currVer?.version,
        bump_type: currVer?.bump_type || undefined,
        changelog_message: currVer?.changelog_message || undefined,
      });
    }
  }

  // Removed
  for (const prev of prevComponents) {
    if (!thisMap.has(prev.component_key)) {
      const prevVer = verMap.get(prev.component_version_id);
      entries.push({
        component_key: prev.component_key,
        component_name: prev.component_name,
        change_type: 'removed',
        from_version: prevVer?.version,
      });
    }
  }

  const order = { added: 0, updated: 1, removed: 2 };
  entries.sort((a, b) => order[a.change_type] - order[b.change_type]);

  return entries;
}

// --- Helpers ---

export function computeVersion(current: string, bump: BumpType): string {
  const parts = current.split('.').map(Number);
  if (parts.length !== 3) return '1.0.0';

  switch (bump) {
    case 'major': return `${parts[0] + 1}.0.0`;
    case 'minor': return `${parts[0]}.${parts[1] + 1}.0`;
    case 'patch': return `${parts[0]}.${parts[1]}.${parts[2] + 1}`;
  }
}
