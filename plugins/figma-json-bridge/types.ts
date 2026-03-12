// ── Selection info pushed on every selectionchange ──────

export interface SelectionInfo {
  name: string;
  type: string;
  width: number;
  height: number;
  childCount: number;
  variantCount: number | null;
}

// ── Messages: UI → Code ─────────────────────────────────

export type UIMessage =
  | { type: 'export'; includeSvg: boolean }
  | { type: 'import'; snapshot: any; componentName: string }
  | { type: 'resize'; height: number };

// ── Messages: Code → UI ─────────────────────────────────

export type CodeMessage =
  | { type: 'selection-changed'; info: SelectionInfo | null }
  | { type: 'export-progress'; message: string; percent: number }
  | { type: 'export-complete'; json: string }
  | { type: 'import-progress'; message: string; percent: number }
  | { type: 'import-complete'; nodeId: string; warnings: string[] }
  | { type: 'error'; message: string };
