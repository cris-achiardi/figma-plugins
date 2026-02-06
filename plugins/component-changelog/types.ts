// Version status workflow
export type VersionStatus = 'draft' | 'in_review' | 'approved' | 'published';
export type BumpType = 'patch' | 'minor' | 'major';
export type AuditAction = 'created' | 'submitted_for_review' | 'approved' | 'published' | 'rejected';
export type Scope = 'page' | 'selection';

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

// Extracted component data (from Figma sandbox)
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

// Messages: UI -> Code
export type UIMessage =
  | { type: 'extract-components'; scope: Scope }
  | { type: 'extract-single'; nodeId: string }
  | { type: 'navigate'; nodeId: string }
  | { type: 'reconstruct'; snapshot: any };

// Messages: Code -> UI
export type CodeMessage =
  | { type: 'init'; userName: string; fileKey: string }
  | { type: 'extraction-complete'; components: ExtractedComponent[] }
  | { type: 'extraction-progress'; message: string; percent: number }
  | { type: 'reconstruction-complete'; nodeId: string }
  | { type: 'error'; message: string };
