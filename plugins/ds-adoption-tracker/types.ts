// Scope options for analysis
export type Scope = 'file' | 'page' | 'selection';

// Export format options
export type ExportFormat = 'json' | 'csv';

// Component statistics
export interface ComponentStats {
  id: string;
  key: string;
  name: string;
  libraryName: string | null;
  isExternal: boolean;
  instanceCount: number;
  instanceIds: string[];
  // Dependency tracking for atomic design analysis
  usedInComponents: string[];   // Parent component IDs where this is nested
  nestedComponents: string[];   // Child component IDs used within this
}

// Detached instance info
export interface DetachedInstance {
  frameId: string;
  frameName: string;
  originalComponentKey: string;
  originalComponentName: string | null;
}

// Analysis result
export interface AnalysisResult {
  scope: Scope;
  timestamp: string;
  fileName: string;
  pageName: string;
  totalInstances: number;
  totalDetached: number;
  uniqueComponents: number;
  externalComponents: number;
  localComponents: number;
  components: ComponentStats[];
  detachedInstances: DetachedInstance[];
  dependencies: {
    graph: Record<string, string[]>;
  };
}

// Messages: UI -> Code
export type UIMessage =
  | { type: 'analyze'; scope: Scope }
  | { type: 'navigate'; nodeId: string }
  | { type: 'export'; format: ExportFormat; result: AnalysisResult };

// Messages: Code -> UI
export type CodeMessage =
  | { type: 'analysis-complete'; result: AnalysisResult }
  | { type: 'analysis-progress'; message: string; percent: number }
  | { type: 'error'; message: string }
  | { type: 'selection-changed'; hasSelection: boolean; count: number }
  | { type: 'init'; hasSelection: boolean; count: number };
