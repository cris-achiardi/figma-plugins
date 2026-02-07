/**
 * Data layer — re-exports read-only Supabase functions from the plugin.
 * The Astro Vite alias @plugin/supabase resolves to the plugin's supabase.ts.
 */
export {
  supabase,
  getProjectVersionMaps,
  getVersionHistory,
  getLatestPublished,
  getAuditLog,
  getVersionById,
  getLibraryVersionHistory,
  getLatestLibraryVersion,
  getLibraryVersionComponents,
  getLibraryVersionChangelog,
  computeLibraryChangelog,
} from '@plugin/supabase';

export type {
  ComponentVersion,
  Project,
  AuditEntry,
  VersionStatus,
  BumpType,
  LibraryVersion,
  LibraryVersionComponent,
  LibraryChangelogEntry,
} from '@plugin/types';

import { supabase } from '@plugin/supabase';
import type { ComponentVersion, AuditEntry } from '@plugin/types';

/** Like getVersionHistory but excludes the large `snapshot` column. */
export async function getVersionHistorySlim(
  componentKey: string,
  projectId: string
): Promise<Omit<ComponentVersion, 'snapshot'>[]> {
  const { data, error } = await supabase
    .from('component_versions')
    .select('id, project_id, component_key, component_name, version, status, property_definitions, variables_used, thumbnail_url, diff, changelog_message, bump_type, created_by, reviewed_by, published_at, created_at, updated_at')
    .eq('component_key', componentKey)
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Failed to get history: ${error.message}`);
  return (data || []) as Omit<ComponentVersion, 'snapshot'>[];
}

/** Fetch only the snapshot column for given version IDs. */
export async function getVersionSnapshots(
  versionIds: string[]
): Promise<Record<string, any>> {
  if (versionIds.length === 0) return {};

  const { data, error } = await supabase
    .from('component_versions')
    .select('id, snapshot')
    .in('id', versionIds);

  if (error) throw new Error(`Failed to get snapshots: ${error.message}`);

  const result: Record<string, any> = {};
  for (const row of data || []) {
    result[row.id] = row.snapshot;
  }
  return result;
}

/** Batch-fetch audit logs for multiple version IDs in a single query. */
export async function getBatchAuditLogs(
  versionIds: string[]
): Promise<Record<string, AuditEntry[]>> {
  if (versionIds.length === 0) return {};

  const { data, error } = await supabase
    .from('audit_log')
    .select('*')
    .in('component_version_id', versionIds)
    .order('created_at', { ascending: true });

  if (error) throw new Error(`Failed to get audit logs: ${error.message}`);

  const result: Record<string, AuditEntry[]> = {};
  for (const entry of (data || []) as AuditEntry[]) {
    if (!result[entry.component_version_id]) {
      result[entry.component_version_id] = [];
    }
    result[entry.component_version_id].push(entry);
  }
  return result;
}
