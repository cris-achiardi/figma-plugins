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
