import { createClient } from '@supabase/supabase-js';
import type { ComponentVersion, AuditAction, BumpType, Project } from './types';

const SUPABASE_URL = 'https://nwweqcjiklzmlmvbfjkt.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im53d2VxY2ppa2x6bWxtdmJmamt0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0MTMwNDgsImV4cCI6MjA4NTk4OTA0OH0.G8P90aYwynGDfEgvCNfmOqY5IlE5ppVn6Vgb_e7b56w';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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
}): Promise<ComponentVersion> {
  // Determine next version based on latest published
  const latest = await getLatestPublished(params.componentKey, params.projectId);
  const nextVersion = latest ? latest.version : '0.1.0';

  const { data, error } = await supabase
    .from('component_versions')
    .insert({
      project_id: params.projectId,
      component_key: params.componentKey,
      component_name: params.componentName,
      version: nextVersion,
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

  await logAudit(data.id, 'created', params.createdBy);
  return data as ComponentVersion;
}

export async function submitForReview(versionId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('component_versions')
    .update({ status: 'in_review', updated_at: new Date().toISOString() })
    .eq('id', versionId);

  if (error) throw new Error(`Failed to submit for review: ${error.message}`);
  await logAudit(versionId, 'submitted_for_review', userId);
}

export async function approveVersion(versionId: string, reviewerId: string): Promise<void> {
  const { error } = await supabase
    .from('component_versions')
    .update({
      status: 'approved',
      reviewed_by: reviewerId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', versionId);

  if (error) throw new Error(`Failed to approve: ${error.message}`);
  await logAudit(versionId, 'approved', reviewerId);
}

export async function rejectVersion(versionId: string, reviewerId: string, note?: string): Promise<void> {
  const { error } = await supabase
    .from('component_versions')
    .update({
      status: 'draft',
      reviewed_by: reviewerId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', versionId);

  if (error) throw new Error(`Failed to reject: ${error.message}`);
  await logAudit(versionId, 'rejected', reviewerId, note);
}

export async function publishVersion(
  versionId: string,
  bumpType: BumpType,
  message: string,
  userId: string
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
  await logAudit(versionId, 'published', userId, `Published as ${newVersion}`);
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

export async function getVersionById(versionId: string): Promise<ComponentVersion | null> {
  const { data } = await supabase
    .from('component_versions')
    .select('*')
    .eq('id', versionId)
    .single();

  return (data as ComponentVersion) || null;
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
  note?: string
): Promise<void> {
  const { error } = await supabase
    .from('audit_log')
    .insert({
      component_version_id: versionId,
      action,
      performed_by: userId,
      note: note || null,
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
