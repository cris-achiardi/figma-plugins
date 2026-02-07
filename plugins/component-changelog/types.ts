// Version status workflow
export type VersionStatus = 'draft' | 'in_review' | 'approved' | 'published' | 'deprecated';
export type BumpType = 'patch' | 'minor' | 'major';
export type AuditAction = 'created' | 'submitted_for_review' | 'approved' | 'published' | 'rejected';

// OAuth / Figma user
export interface FigmaUser {
  id: string;
  name: string;
  email: string;
}

// Library info from REST API
export interface LibraryInfo {
  fileKey: string;
  name: string;
  componentCount: number;
}

// Library component from REST API
export interface LibraryComponent {
  key: string;
  name: string;
  description: string;
  nodeId: string;
  thumbnailUrl: string;
  componentSetId: string | null;
  componentSetName: string | null;
}

// Data models (match Supabase schema)
export interface ComponentVersion {
  id: string;
  project_id: string;
  component_key: string;
  component_name: string;
  version: string;
  status: VersionStatus;
  snapshot: any;
  property_definitions: any;
  variables_used: any;
  thumbnail_url: string | null;
  diff: any | null;
  changelog_message: string | null;
  bump_type: BumpType | null;
  created_by: string;
  reviewed_by: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuditEntry {
  id: string;
  component_version_id: string;
  action: AuditAction;
  performed_by: string;
  note: string | null;
  created_at: string;
}

export interface Project {
  id: string;
  name: string;
  figma_file_key: string | null;
  created_at: string;
}

// Grouped component (variants grouped by component set)
export interface ComponentGroup {
  /** Display name (base name before " / " or standalone name) */
  baseName: string;
  /** All variants in this group */
  variants: LibraryComponent[];
  /** Thumbnail from the first variant */
  thumbnailUrl: string;
  /** The componentSetId (null for standalone components) */
  componentSetId: string | null;
}

// Extracted component data (from Figma sandbox via Plugin API)
export interface ExtractedComponent {
  key: string;
  name: string;
  nodeId: string;
  snapshot: any;
  propertyDefinitions: any;
  variablesUsed: any;
  thumbnailBytes: number[];
  publishStatus: string;
}

// Local component scan result from Plugin API
export interface LocalComponentGroup {
  /** Component set name (or standalone component name) */
  name: string;
  /** Node ID of the component set (or standalone component) */
  nodeId: string;
  /** Component key */
  key: string;
  /** Thumbnail as PNG bytes */
  thumbnailBytes: number[];
  /** Number of variants (1 for standalone) */
  variantCount: number;
  /** Variant names (for component sets) */
  variants: { name: string; nodeId: string; key: string }[];
}

// Messages: UI -> Code
export type UIMessage =
  | { type: 'extract-selected'; nodeIds: string[] }
  | { type: 'extract-single'; nodeId: string }
  | { type: 'navigate'; nodeId: string }
  | { type: 'save-settings'; token: string; fileKey: string; userName: string }
  | { type: 'load-settings' }
  | { type: 'clear-settings' }
  | { type: 'reconstruct'; snapshot: any }
  | { type: 'scan-local-components' };

// Messages: Code -> UI
export type CodeMessage =
  | { type: 'init'; userName: string; fileKey: string; savedToken?: string; savedFileKey?: string; savedUserName?: string }
  | { type: 'settings-loaded'; token: string | null; fileKey: string | null; userName: string | null }
  | { type: 'extraction-complete'; components: ExtractedComponent[] }
  | { type: 'extraction-progress'; message: string; percent: number }
  | { type: 'local-components'; groups: LocalComponentGroup[] }
  | { type: 'error'; message: string };
