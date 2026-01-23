# DS Adoption Tracker - Plugin Plan

## Overview

A Figma plugin for Design System specialists to measure component adoption across Figma files. The plugin counts component instances and detects detached instances (component drift) to provide actionable insights on design system health.

---

## Problem Statement

Design System teams need to:
1. **Measure adoption** - How many times are DS components being used?
2. **Track coverage** - Which components are most/least used?
3. **Detect drift** - Which instances have been detached and are now out of sync?
4. **Report metrics** - Export data for dashboards and stakeholder reporting

Currently, this requires manual inspection or expensive third-party tools.

---

## User Stories

### Primary User: Design System Specialist

> *"As a DS specialist, I want to measure component adoption across Figma files so I can report on design system health and identify areas for improvement."*

**Acceptance Criteria:**
- [ ] Select scope: Current File, Current Page, or Selected Frames
- [ ] View component list with instance counts
- [ ] Sort/filter results by count, name, or library
- [ ] Export results as JSON
- [ ] Identify external (library) vs local components

### Extended Feature: Detached Instance Detection

> *"As a DS specialist, I want to identify detached instances so I can measure component drift and encourage teams to reconnect to the design system."*

**Acceptance Criteria:**
- [ ] List all frames that were previously component instances
- [ ] Show which component they were detached from
- [ ] Include detached instances in export

---

## Technical Approach

### Figma Plugin API

#### Counting Instances

```typescript
// Scope: Current File
await figma.loadAllPagesAsync();
const instances = figma.root.findAllWithCriteria({ types: ['INSTANCE'] });

// Scope: Current Page
const instances = figma.currentPage.findAllWithCriteria({ types: ['INSTANCE'] });

// Scope: Selection
const instances: InstanceNode[] = [];
for (const node of figma.currentPage.selection) {
  if (node.type === 'INSTANCE') {
    instances.push(node);
  }
  if ('findAllWithCriteria' in node) {
    instances.push(...node.findAllWithCriteria({ types: ['INSTANCE'] }));
  }
}
```

#### Grouping by Component

```typescript
interface ComponentStats {
  id: string;
  key: string;           // For library components
  name: string;
  libraryName: string | null;
  isExternal: boolean;
  instanceCount: number;
  instanceIds: string[]; // For navigation
  // Dependency tracking
  usedInComponents: string[];  // Parent component IDs where this is nested
  nestedComponents: string[];  // Child component IDs used within this
}

async function groupByComponent(instances: InstanceNode[]): Promise<Map<string, ComponentStats>> {
  const stats = new Map<string, ComponentStats>();

  for (const instance of instances) {
    const main = await instance.getMainComponentAsync();
    if (!main) continue;

    const key = main.id;
    const existing = stats.get(key) || {
      id: main.id,
      key: main.key,
      name: main.name,
      libraryName: null, // TODO: Resolve from getPublishStatusAsync
      isExternal: main.remote,
      instanceCount: 0,
      instanceIds: [],
      usedInComponents: [],
      nestedComponents: []
    };

    existing.instanceCount++;
    existing.instanceIds.push(instance.id);

    // Track parent component (if nested inside another instance)
    const parentInstance = findParentInstance(instance);
    if (parentInstance) {
      const parentMain = await parentInstance.getMainComponentAsync();
      if (parentMain && !existing.usedInComponents.includes(parentMain.id)) {
        existing.usedInComponents.push(parentMain.id);
      }
    }

    stats.set(key, existing);
  }

  return stats;
}

// Helper: Find if instance is nested inside another instance
function findParentInstance(node: SceneNode): InstanceNode | null {
  let parent = node.parent;
  while (parent && parent.type !== 'PAGE' && parent.type !== 'DOCUMENT') {
    if (parent.type === 'INSTANCE') {
      return parent as InstanceNode;
    }
    parent = parent.parent;
  }
  return null;
}
```

#### Detecting Detached Instances

```typescript
interface DetachedInfo {
  frameId: string;
  frameName: string;
  componentKey: string;  // Original component key
  componentId: string;   // Original component id (local)
}

function findDetachedInstances(scope: BaseNode): DetachedInfo[] {
  const frames = scope.findAllWithCriteria({ types: ['FRAME'] });

  return frames
    .filter(frame => frame.detachedInfo !== null)
    .map(frame => ({
      frameId: frame.id,
      frameName: frame.name,
      componentKey: frame.detachedInfo!.componentKey,
      componentId: frame.detachedInfo!.componentId
    }));
}
```

---

## Nested Instance & Dependency Tracking

### Atomic Design Levels

The plugin tracks component usage at all atomic levels:

```
Page
└── Template (Card Grid)           ← Instance of Card Grid
    └── Organism (Card)            ← Instance of Card (nested in Card Grid)
        └── Molecule (Button)      ← Instance of Button (nested in Card)
            └── Atom (Icon)        ← Instance of Icon (nested in Button)
```

Each instance is counted separately, enabling analysis like:
- "Button is used 142 times total"
- "Button is used inside Card 45 times, inside Form 30 times, standalone 67 times"

### Dependency Graph

The export includes a dependency graph showing which components contain other components:

```
Card/Default
├── uses → Button/Primary
├── uses → Icon/Close
└── uses → Text/Body

Button/Primary
└── uses → Icon/Arrow
```

This helps identify:
- **High-impact components** - If Button changes, which parent components are affected?
- **Composition patterns** - How are atoms combined into molecules/organisms?
- **Unused components** - Components with zero instances at any level

---

## Architecture

### File Structure

Following existing plugin patterns:

```
plugins/
└── ds-adoption-tracker/
    ├── manifest.json        # Plugin metadata
    ├── package.json         # Dependencies
    ├── tsconfig.json        # TypeScript config
    ├── code.ts              # Figma sandbox logic
    ├── ui.tsx               # React UI
    ├── types.ts             # Shared type definitions
    ├── ui-template.html     # HTML template
    ├── inline-ui.js         # Build script (copy from code-syntax-generator)
    └── README.md            # Plugin documentation
```

### Message Types

```typescript
// types.ts

export type Scope = 'file' | 'page' | 'selection';

export interface ComponentStats {
  id: string;
  key: string;
  name: string;
  libraryName: string | null;
  isExternal: boolean;
  instanceCount: number;
  // Dependency tracking for atomic design analysis
  usedInComponents: string[];   // Parent components where this is nested
  nestedComponents: string[];   // Child components used within this
}

export interface DetachedInstance {
  frameId: string;
  frameName: string;
  originalComponentKey: string;
  originalComponentName: string | null;
}

export interface AnalysisResult {
  scope: Scope;
  timestamp: string;
  fileName: string;
  pageName: string;
  totalInstances: number;
  totalDetached: number;
  components: ComponentStats[];
  detachedInstances: DetachedInstance[];
}

export type ExportFormat = 'json' | 'csv';

// Messages: UI → Code
export type UIMessage =
  | { type: 'analyze'; scope: Scope }
  | { type: 'navigate'; nodeId: string }
  | { type: 'export'; format: ExportFormat };

// Messages: Code → UI
export type CodeMessage =
  | { type: 'analysis-complete'; result: AnalysisResult }
  | { type: 'analysis-progress'; message: string; percent: number }
  | { type: 'error'; message: string }
  | { type: 'selection-changed'; hasSelection: boolean };
```

---

## UI Design

### Layout Structure (2-Column)

**Dimensions:** ~550px wide × ~400px tall

| Left Column (Fixed ~200px) | Right Column (Flexible) |
|---------------------------|------------------------|
| Scope dropdown | Tabs (Instances / Detached) |
| Analyze button | Search + Sort controls |
| Summary stat cards (2×2 grid) | Scrollable results list |
| Export buttons (JSON / CSV) | |
| Filter checkboxes | |
| About button | |

### Main View (Instances Tab)

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│  DS Adoption Tracker                                                      [?]  [×]   │
├──────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│  ┌─────────────────────────────────┐    ┌──────────────────────────────────────────┐│
│  │                                 │    │                                          ││
│  │  Scope                          │    │  ┌────────────────┐ ┌────────────────┐   ││
│  │  ┌───────────────────────────┐  │    │  │   Instances    │ │    Detached    │   ││
│  │  │ ○ Current Page          ▼ │  │    │  └────────────────┴─┴────────────────┘   ││
│  │  └───────────────────────────┘  │    │                                          ││
│  │                                 │    │  ┌──────────────────────────────────────┐││
│  │  ┌─────────────────────────┐    │    │  │ 🔍 Search...                         │││
│  │  │        Analyze          │    │    │  └──────────────────────────────────────┘││
│  │  └─────────────────────────┘    │    │                                          ││
│  │                                 │    │  Sort ┌──────────────────┐               ││
│  │  ─────────────────────────────  │    │       │ Count          ▼ │               ││
│  │                                 │    │       └──────────────────┘               ││
│  │  Summary                        │    │                                          ││
│  │  ┌───────────┐ ┌───────────┐   │    │  ┌──────────────────────────────────────┐││
│  │  │    847    │ │     23    │   │    │  │                                      │││
│  │  │   Uses    │ │   Comps   │   │    │  │ ┌────┐ Button/Primary                │││
│  │  └───────────┘ └───────────┘   │    │  │ │142 │ Core DS · External            │││
│  │  ┌───────────┐ ┌───────────┐   │    │  │ └────┘ in: Card, Form, Modal         │││
│  │  │     18    │ │     12    │   │    │  │                                      │││
│  │  │  Library  │ │ Detached  │   │    │  ├──────────────────────────────────────│││
│  │  └───────────┘ └───────────┘   │    │  │                                      │││
│  │                                 │    │  │ ┌────┐ Input/Text                    │││
│  │  ─────────────────────────────  │    │  │ │ 89 │ Core DS · External            │││
│  │                                 │    │  │ └────┘ in: Form, SearchBar           │││
│  │  Export                         │    │  │                                      │││
│  │  ┌───────────┐ ┌───────────┐   │    │  ├──────────────────────────────────────│││
│  │  │   JSON    │ │    CSV    │   │    │  │                                      │││
│  │  └───────────┘ └───────────┘   │    │  │ ┌────┐ Card/Default                  │││
│  │                                 │    │  │ │ 67 │ Core DS · External            │││
│  │  ─────────────────────────────  │    │  │ └────┘ has: Button, Icon, Text       │││
│  │                                 │    │  │                                      │││
│  │  ☑ External only               │    │  ├──────────────────────────────────────│││
│  │  ☐ Hide zero counts            │    │  │                                      │││
│  │                                 │    │  │ ┌────┐ Icon/Close                    │││
│  │                                 │    │  │ │ 45 │ Core DS · External            │││
│  │         ┌───────────┐          │    │  │ └────┘ in: Card, Modal, Alert         │││
│  │         │   About   │          │    │  │                                      │││
│  │         └───────────┘          │    │  └──────────────────────────────────────┘││
│  │                                 │    │                                          ││
│  └─────────────────────────────────┘    └──────────────────────────────────────────┘│
│                                                                                      │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

### Detached Tab View

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│  DS Adoption Tracker                                                      [?]  [×]   │
├──────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│  ┌─────────────────────────────────┐    ┌──────────────────────────────────────────┐│
│  │                                 │    │                                          ││
│  │  Scope                          │    │  ┌────────────────┐ ┌────────────────┐   ││
│  │  ┌───────────────────────────┐  │    │  │    Instances   │ │  ● Detached    │   ││
│  │  │ ○ Current Page          ▼ │  │    │  └────────────────┴─┴────────────────┘   ││
│  │  └───────────────────────────┘  │    │                                          ││
│  │                                 │    │  ⚠️ 12 detached instances                 ││
│  │  ┌─────────────────────────┐    │    │                                          ││
│  │  │        Analyze          │    │    │  Frames disconnected from DS.            ││
│  │  └─────────────────────────┘    │    │  Consider reconnecting.                  ││
│  │                                 │    │                                          ││
│  │  ─────────────────────────────  │    │  ┌──────────────────────────────────────┐││
│  │                                 │    │  │                                      │││
│  │  Summary                        │    │  │ "Header - Modified"             [→]  │││
│  │  ┌───────────┐ ┌───────────┐   │    │  │  ↳ Was: Navigation/Header            │││
│  │  │    847    │ │     23    │   │    │  │    Core DS                           │││
│  │  │   Uses    │ │   Comps   │   │    │  │                                      │││
│  │  └───────────┘ └───────────┘   │    │  ├──────────────────────────────────────│││
│  │  ┌───────────┐ ┌───────────┐   │    │  │                                      │││
│  │  │     18    │ │     12    │   │    │  │ "Card Custom Version"           [→]  │││
│  │  │  Library  │ │ Detached  │   │    │  │  ↳ Was: Card/Default                 │││
│  │  └───────────┘ └───────────┘   │    │  │    Core DS                           │││
│  │                                 │    │  │                                      │││
│  │  ─────────────────────────────  │    │  ├──────────────────────────────────────│││
│  │                                 │    │  │                                      │││
│  │  Export                         │    │  │ "Special Button"               [→]  │││
│  │  ┌───────────┐ ┌───────────┐   │    │  │  ↳ Was: Button/Primary               │││
│  │  │   JSON    │ │    CSV    │   │    │  │    Core DS                           │││
│  │  └───────────┘ └───────────┘   │    │  │                                      │││
│  │                                 │    │  └──────────────────────────────────────┘││
│  │                                 │    │                                          ││
│  │         ┌───────────┐          │    │  [→] = Select in canvas                  ││
│  │         │   About   │          │    │                                          ││
│  │         └───────────┘          │    │                                          ││
│  │                                 │    │                                          ││
│  └─────────────────────────────────┘    └──────────────────────────────────────────┘│
│                                                                                      │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

### Loading State

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│  DS Adoption Tracker                                                      [?]  [×]   │
├──────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│  ┌─────────────────────────────────┐    ┌──────────────────────────────────────────┐│
│  │                                 │    │                                          ││
│  │  Scope                          │    │                                          ││
│  │  ┌───────────────────────────┐  │    │                                          ││
│  │  │ ● Current File          ▼ │  │    │                                          ││
│  │  └───────────────────────────┘  │    │                                          ││
│  │                                 │    │      ┌──────────────────────────────┐    ││
│  │  ┌─────────────────────────┐    │    │      │ ████████████░░░░░░░░░░░░░░░░ │    ││
│  │  │      Analyzing...       │    │    │      └──────────────────────────────┘    ││
│  │  └─────────────────────────┘    │    │                   45%                    ││
│  │                                 │    │                                          ││
│  │  ─────────────────────────────  │    │         Analyzing page 3 of 8...         ││
│  │                                 │    │         Found 423 instances              ││
│  │  Summary                        │    │                                          ││
│  │  ┌───────────┐ ┌───────────┐   │    │                                          ││
│  │  │     —     │ │     —     │   │    │                                          ││
│  │  │   Uses    │ │   Comps   │   │    │                                          ││
│  │  └───────────┘ └───────────┘   │    │                                          ││
│  │  ┌───────────┐ ┌───────────┐   │    │                                          ││
│  │  │     —     │ │     —     │   │    │                                          ││
│  │  │  Library  │ │ Detached  │   │    │                                          ││
│  │  └───────────┘ └───────────┘   │    │                                          ││
│  │                                 │    │                                          ││
│  └─────────────────────────────────┘    └──────────────────────────────────────────┘│
│                                                                                      │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

### Empty / Initial State

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│  DS Adoption Tracker                                                      [?]  [×]   │
├──────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│  ┌─────────────────────────────────┐    ┌──────────────────────────────────────────┐│
│  │                                 │    │                                          ││
│  │  Scope                          │    │                                          ││
│  │  ┌───────────────────────────┐  │    │                                          ││
│  │  │ ○ Current Page          ▼ │  │    │                                          ││
│  │  └───────────────────────────┘  │    │                  📊                      ││
│  │                                 │    │                                          ││
│  │  ┌─────────────────────────┐    │    │       Select a scope and click           ││
│  │  │        Analyze          │    │    │       Analyze to get started             ││
│  │  └─────────────────────────┘    │    │                                          ││
│  │                                 │    │                                          ││
│  │  ─────────────────────────────  │    │                                          ││
│  │                                 │    │                                          ││
│  │  Summary                        │    │                                          ││
│  │  ┌───────────┐ ┌───────────┐   │    │                                          ││
│  │  │     —     │ │     —     │   │    │                                          ││
│  │  │   Uses    │ │   Comps   │   │    │                                          ││
│  │  └───────────┘ └───────────┘   │    │                                          ││
│  │  ┌───────────┐ ┌───────────┐   │    │                                          ││
│  │  │     —     │ │     —     │   │    │                                          ││
│  │  │  Library  │ │ Detached  │   │    │                                          ││
│  │  └───────────┘ └───────────┘   │    │                                          ││
│  │                                 │    │                                          ││
│  └─────────────────────────────────┘    └──────────────────────────────────────────┘│
│                                                                                      │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

### UI Components (from shared-ui)

| Component | Usage |
|-----------|-------|
| `Dropdown` | Scope selector, Sort selector |
| `Button` | Analyze, Export, navigation actions |
| `Tabs` | Instances / Detached view switching |
| `Input` | Search filter |
| `Modal` | About dialog |

### Custom Components (plugin-specific)

| Component | Description |
|-----------|-------------|
| `StatCard` | Summary metric display (count + label) |
| `ComponentRow` | Single component with count badge |
| `DetachedRow` | Single detached instance with original component |
| `ProgressBar` | Analysis progress indicator |

---

## State Management

```typescript
interface UIState {
  // Analysis state
  isAnalyzing: boolean;
  progress: { message: string; percent: number } | null;
  result: AnalysisResult | null;
  error: string | null;

  // UI state
  scope: Scope;
  activeTab: 'instances' | 'detached';
  searchQuery: string;
  sortBy: 'count' | 'name' | 'library';
  sortDirection: 'asc' | 'desc';

  // Selection state
  hasSelection: boolean;
}
```

---

## Export Format

### JSON Structure

Full structured data for AI tools, dashboards, and programmatic analysis.

```json
{
  "meta": {
    "pluginVersion": "1.0.0",
    "exportedAt": "2026-01-23T15:30:00.000Z",
    "scope": "page",
    "fileName": "Design System v3",
    "pageName": "Components"
  },
  "summary": {
    "totalInstances": 847,
    "uniqueComponents": 23,
    "externalComponents": 18,
    "localComponents": 5,
    "detachedInstances": 12
  },
  "components": [
    {
      "id": "1:234",
      "key": "abc123def456...",
      "name": "Button/Primary",
      "library": "Core DS",
      "isExternal": true,
      "instanceCount": 142,
      "usedInComponents": ["1:500", "1:600"],
      "nestedComponents": []
    },
    {
      "id": "1:500",
      "key": "def789...",
      "name": "Card/Default",
      "library": "Core DS",
      "isExternal": true,
      "instanceCount": 45,
      "usedInComponents": [],
      "nestedComponents": ["1:234", "1:235"]
    }
  ],
  "detached": [
    {
      "frameId": "5:678",
      "frameName": "Header Copy",
      "originalComponent": {
        "key": "xyz789...",
        "name": "Navigation/Header"
      }
    }
  ],
  "dependencies": {
    "summary": "Component dependency graph for atomic design analysis",
    "graph": {
      "1:500": ["1:234", "1:235"],
      "1:600": ["1:234"]
    }
  }
}
```

### CSV Structure

Flat format for Excel, Google Sheets, and traditional reporting tools.

**components.csv**
```csv
id,key,name,library,isExternal,instanceCount,usedInComponents,nestedComponents
1:234,abc123def456...,Button/Primary,Core DS,true,142,"1:500,1:600",""
1:500,def789...,Card/Default,Core DS,true,45,"","1:234,1:235"
```

**detached.csv**
```csv
frameId,frameName,originalComponentKey,originalComponentName
5:678,Header Copy,xyz789...,Navigation/Header
```

**summary.csv**
```csv
metric,value
exportedAt,2026-01-23T15:30:00.000Z
scope,page
fileName,Design System v3
pageName,Components
totalInstances,847
uniqueComponents,23
externalComponents,18
localComponents,5
detachedInstances,12
```

### Export Options

| Format | Use Case |
|--------|----------|
| **JSON** | AI tools, custom dashboards, programmatic analysis |
| **CSV (zip)** | Excel, Google Sheets, stakeholder reports |
```

---

## Implementation Phases

### Phase 1: Core Instance Counting (MVP)

**Scope:** Basic instance counting with export

**Tasks:**
- [ ] Scaffold plugin structure (manifest, package.json, tsconfig)
- [ ] Implement scope selection (File/Page/Selection)
- [ ] Count instances and group by component
- [ ] Track nested instances and dependency relationships
- [ ] Basic UI with results table
- [ ] JSON export functionality
- [ ] CSV export functionality

**Estimated Effort:** Foundation

### Phase 2: Enhanced UI & Detached Detection

**Scope:** Full UI with detached instance tracking

**Tasks:**
- [ ] Add detached instance detection
- [ ] Implement Tabs for Instances/Detached views
- [ ] Add search and sort functionality
- [ ] Add summary stat cards
- [ ] Progress indicator for large files
- [ ] Click-to-navigate functionality

**Estimated Effort:** Feature complete

### Phase 3: Polish & Publishing

**Scope:** Production-ready release

**Tasks:**
- [ ] Error handling and edge cases
- [ ] Performance optimization for large files
- [ ] About modal with usage instructions
- [ ] Plugin icon and cover image
- [ ] README documentation
- [ ] Figma Community submission

**Estimated Effort:** Polish

---

## Performance Considerations

### Large File Handling

For files with 10,000+ nodes:

1. **Use `skipInvisibleInstanceChildren`**
   ```typescript
   figma.skipInvisibleInstanceChildren = true;
   ```

2. **Batch processing with progress updates**
   ```typescript
   const BATCH_SIZE = 500;
   for (let i = 0; i < instances.length; i += BATCH_SIZE) {
     const batch = instances.slice(i, i + BATCH_SIZE);
     // Process batch...
     figma.ui.postMessage({
       type: 'analysis-progress',
       percent: Math.round((i / instances.length) * 100)
     });
     await new Promise(r => setTimeout(r, 0)); // Yield to UI
   }
   ```

3. **Async component resolution**
   - Use `getMainComponentAsync()` instead of deprecated `mainComponent`
   - Batch async calls where possible

---

## Design Decisions

| Decision | Resolution |
|----------|------------|
| **Nested instances** | ✅ Count separately - enables atomic design level tracking and dependency analysis |
| **Export formats** | ✅ Both JSON and CSV - JSON for AI/dashboards, CSV for Excel/Sheets |
| **Historical tracking** | ❌ Not needed - plugin provides raw data snapshot only |

---

## Open Questions

1. **Library resolution**
   - How to get library name for external components?
   - `getPublishStatusAsync()` or other API?

2. **Dependency visualization**
   - Should we show a visual dependency tree in the UI?
   - Or keep UI simple and let exports handle deep analysis?

---

## References

- [Figma Plugin API - InstanceNode](https://www.figma.com/plugin-docs/api/InstanceNode/)
- [Figma Plugin API - findAllWithCriteria](https://www.figma.com/plugin-docs/api/properties/nodes-findallwithcriteria/)
- [Figma Plugin API - detachedInfo](https://www.figma.com/plugin-docs/api/properties/BaseFrameMixin-detachedinfo/)
- Existing plugin: `plugins/code-syntax-generator/`
- Shared UI: `packages/shared-ui/`