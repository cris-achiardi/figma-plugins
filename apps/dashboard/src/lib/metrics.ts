import { supabase } from './data';
import type { ComponentVersion, Project } from './data';

/** List all projects */
export async function getProjects(): Promise<Project[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Failed to get projects: ${error.message}`);
  return (data || []) as Project[];
}

/** Unique components that have at least one version (published or draft) */
export async function getComponentSummaries(projectId: string): Promise<{
  key: string;
  name: string;
  latestVersion: string;
  status: string;
  thumbnailUrl: string | null;
  updatedAt: string;
}[]> {
  const { data } = await supabase
    .from('component_versions')
    .select('component_key, component_name, version, status, thumbnail_url, updated_at')
    .eq('project_id', projectId)
    .order('updated_at', { ascending: false });

  const versions = (data || []) as ComponentVersion[];

  // Group by component_key, pick latest meaningful version
  const map = new Map<string, {
    key: string;
    name: string;
    latestVersion: string;
    status: string;
    thumbnailUrl: string | null;
    updatedAt: string;
  }>();

  for (const v of versions) {
    if (map.has(v.component_key)) continue;
    map.set(v.component_key, {
      key: v.component_key,
      name: v.component_name,
      latestVersion: v.version,
      status: v.status,
      thumbnailUrl: v.thumbnail_url,
      updatedAt: v.updated_at,
    });
  }

  return [...map.values()];
}

/** Percentage of tracked components that have at least one published version */
export async function calculateCoverage(projectId: string): Promise<number> {
  const { data } = await supabase
    .from('component_versions')
    .select('component_key, status')
    .eq('project_id', projectId);

  const versions = (data || []) as Pick<ComponentVersion, 'component_key' | 'status'>[];
  const allKeys = new Set(versions.map(v => v.component_key));
  const publishedKeys = new Set(
    versions.filter(v => v.status === 'published').map(v => v.component_key)
  );

  if (allKeys.size === 0) return 0;
  return Math.round((publishedKeys.size / allKeys.size) * 100);
}

/** Count of components with unpublished drafts */
export async function calculateDrift(projectId: string): Promise<number> {
  const { data } = await supabase
    .from('component_versions')
    .select('component_key, status')
    .eq('project_id', projectId)
    .in('status', ['draft', 'in_review', 'approved']);

  const keys = new Set((data || []).map((v: any) => v.component_key));
  return keys.size;
}

/** Recent audit log entries across the whole project */
export async function getRecentActivity(projectId: string, limit = 20): Promise<{
  id: string;
  action: string;
  performedBy: string;
  note: string | null;
  createdAt: string;
  componentName: string;
  version: string;
}[]> {
  // Get all version IDs for this project first
  const { data: versions } = await supabase
    .from('component_versions')
    .select('id, component_name, version')
    .eq('project_id', projectId);

  if (!versions || versions.length === 0) return [];

  const versionIds = versions.map((v: any) => v.id);
  const versionMap = new Map(versions.map((v: any) => [v.id, v]));

  const { data: logs } = await supabase
    .from('audit_log')
    .select('*')
    .in('component_version_id', versionIds)
    .order('created_at', { ascending: false })
    .limit(limit);

  return (logs || []).map((log: any) => {
    const ver = versionMap.get(log.component_version_id);
    return {
      id: log.id,
      action: log.action,
      performedBy: log.performed_by,
      note: log.note,
      createdAt: log.created_at,
      componentName: ver?.component_name || 'Unknown',
      version: ver?.version || '',
    };
  });
}

/** Total published versions count for a project */
export async function getPublishedCount(projectId: string): Promise<number> {
  const { count, error } = await supabase
    .from('component_versions')
    .select('id', { count: 'exact', head: true })
    .eq('project_id', projectId)
    .eq('status', 'published');

  if (error) return 0;
  return count || 0;
}
