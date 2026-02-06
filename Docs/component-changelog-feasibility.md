# Figma Component Changelog & Version Control Plugin — Feasibility Study

## Context

**Goal**: Create a Figma plugin that extracts component data, stores versioned snapshots in Supabase (changelog + version control), and can generate JSON to rebuild full components from the database.

**Verdict: Highly feasible.** The Figma Plugin API provides comprehensive serialization (`JSON_REST_V1`), node creation APIs for reconstruction, and full property access for diffing. Supabase is an ideal backend for JSONB storage, versioning, and asset management.

---

## 1. Extraction — API Surface

### Primary serialization: `JSON_REST_V1`

```ts
const json = await componentNode.exportAsync({ format: "JSON_REST_V1" });
// Returns the exact same JSON structure as the Figma REST API
// Includes: children, fills, strokes, effects, layout, constraints, text, etc.
```

This is the single most powerful tool. It captures the entire node tree in a stable, documented format (same as `GET /v1/files/:key/nodes`).

### Component discovery

```ts
// Find all components and component sets in the current page
const components = figma.currentPage.findAllWithCriteria({
  types: ['COMPONENT', 'COMPONENT_SET']
});

// For full document search (requires documentAccess: "dynamic-page" + loadAllPagesAsync)
await figma.loadAllPagesAsync();
const allComponents = figma.root.findAllWithCriteria({
  types: ['COMPONENT', 'COMPONENT_SET']
});
```

### Metadata available per component

| Property | API | Notes |
|---|---|---|
| Stable library key | `component.key` (PublishableMixin) | Unique across files, stable across versions |
| Publish status | `component.getPublishStatusAsync()` | `CHANGED` / `UNPUBLISHED` / `UP_TO_DATE` |
| Component properties | `component.componentPropertyDefinitions` | Variants, booleans, text, instance-swap + defaults |
| Description | `component.description` / `descriptionMarkdown` | Markdown supported |
| Documentation links | `component.documentationLinks` | Array of URLs |
| Name | `component.name` | |
| Node ID | `component.id` | File-specific, not stable across files |
| All instances | `component.getInstancesAsync()` | Find usage across the file |
| CSS representation | `component.getCSSAsync()` | Key-value CSS |
| Custom plugin data | `component.getPluginData(key)` / `setPluginData(key, value)` | Persistent per-plugin storage on the node itself |

### Variables & styles capture

```ts
// All local variables (design tokens)
const variables = await figma.variables.getLocalVariablesAsync();
const collections = await figma.variables.getLocalVariableCollectionsAsync();

// All local styles
const paintStyles = await figma.getLocalPaintStylesAsync();

// Variable bindings on a specific node
const bindings = node.boundVariables; // fills, strokes, effects, layout props, etc.
```

### Thumbnail generation

```ts
const pngBytes = await component.exportAsync({
  format: 'PNG',
  constraint: { type: 'SCALE', value: 2 }
});
// Store pngBytes in Supabase Storage
```

---

## 2. Storage — Supabase Schema

### Auth model: Anon key + Row Level Security
- Embed Supabase `anon` key in the plugin
- RLS policies restrict data access per project/team
- `figma.currentUser` provides user identity for audit trail

### Database schema

```sql
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  figma_file_key TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE component_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id),
  component_key TEXT NOT NULL,          -- PublishableMixin.key (stable)
  component_name TEXT NOT NULL,
  version INT NOT NULL,
  snapshot JSONB NOT NULL,              -- Full JSON_REST_V1 export
  property_definitions JSONB,           -- componentPropertyDefinitions
  variables_used JSONB,                 -- Bound variable references
  css JSONB,                            -- getCSSAsync() output
  thumbnail_path TEXT,                  -- Path in Supabase Storage
  created_by TEXT,                      -- figma.currentUser.name
  created_at TIMESTAMPTZ DEFAULT now(),
  message TEXT,                         -- Optional version message
  UNIQUE(project_id, component_key, version)
);

CREATE TABLE changelog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  component_version_id UUID REFERENCES component_versions(id),
  previous_version_id UUID REFERENCES component_versions(id),
  diff JSONB NOT NULL,                  -- Property-level diff
  summary TEXT,                         -- Human-readable changes
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Image assets stored in Supabase Storage bucket "component-assets"
-- Referenced by path in component_versions.thumbnail_path
-- Also stores image fill bytes for reconstruction
```

### Diffing strategy

Compute diffs at the application level between two `snapshot` JSONB values:
- **Structural diff**: Nodes added/removed/reordered
- **Property diff**: Per-property changes (fill color changed, padding updated, etc.)
- **Human summary**: "Added 'Disabled' variant, changed primary fill from `#3B82F6` to `#2563EB`"

Libraries like `deep-diff` or `jsondiffpatch` work well. Or a custom recursive differ tailored to the REST API JSON structure.

### Network access (manifest.json)

```json
{
  "networkAccess": {
    "allowedDomains": [
      "https://*.supabase.co",
      "https://*.supabase.in"
    ]
  }
}
```

**Important**: Network requests must happen in the **UI context** (iframe), not the sandbox. The UI sends extracted data to Supabase via `@supabase/supabase-js`, which works in any browser context. Communication between sandbox and UI uses `figma.ui.postMessage()` / `parent.postMessage()`.

---

## 3. Reconstruction — Rebuilding Components from JSON

### Approach: Full `ComponentNode` reconstruction

Walk the JSON tree depth-first, create Figma nodes for each JSON node, apply all properties, then wrap in `ComponentNode`.

### Node creation APIs

```ts
figma.createFrame()              // → FrameNode
figma.createComponent()          // → ComponentNode (empty)
figma.createComponentFromNode()  // → ComponentNode (from existing SceneNode)
figma.createRectangle()          // → RectangleNode
figma.createEllipse()            // → EllipseNode
figma.createPolygon()            // → PolygonNode
figma.createStar()               // → StarNode
figma.createLine()               // → LineNode
figma.createText()               // → TextNode
figma.createVector()             // → VectorNode
figma.createBooleanOperation()   // → BooleanOperationNode

// Hierarchy
parent.appendChild(child)
parent.insertChild(index, child)

// Images
figma.createImage(bytes)         // → Image (returns hash for use in fills)

// Text (must load font before setting characters)
await figma.loadFontAsync({ family: "Inter", style: "Regular" })
textNode.characters = "Hello"

// Component properties
component.addComponentProperty("Disabled", "BOOLEAN", false)
component.addComponentProperty("Label", "TEXT", "Button")
component.addComponentProperty("Size", "VARIANT", "Medium")
```

### Reconstruction algorithm (pseudocode)

```ts
async function reconstructNode(json: any, parent: ChildrenMixin): Promise<SceneNode> {
  let node: SceneNode;

  switch (json.type) {
    case 'FRAME':
      node = figma.createFrame();
      break;
    case 'COMPONENT':
      node = figma.createComponent();
      break;
    case 'RECTANGLE':
      node = figma.createRectangle();
      break;
    case 'TEXT':
      node = figma.createText();
      await figma.loadFontAsync(json.style.fontFamily, json.style.fontPostScriptName);
      (node as TextNode).characters = json.characters;
      break;
    case 'ELLIPSE':
      node = figma.createEllipse();
      break;
    // ... other types
  }

  // Apply common properties
  node.name = json.name;
  node.resize(json.absoluteBoundingBox.width, json.absoluteBoundingBox.height);
  node.x = json.absoluteBoundingBox.x;
  node.y = json.absoluteBoundingBox.y;

  // Apply fills, strokes, effects
  if (json.fills) node.fills = await reconstructFills(json.fills);
  if (json.strokes) node.strokes = json.strokes;
  if (json.effects) node.effects = json.effects;

  // Apply auto-layout
  if (json.layoutMode) {
    node.layoutMode = json.layoutMode; // "HORIZONTAL" | "VERTICAL"
    node.paddingTop = json.paddingTop;
    // ... other layout props
  }

  // Recurse into children
  if (json.children) {
    for (const child of json.children) {
      await reconstructNode(child, node);
    }
  }

  parent.appendChild(node);
  return node;
}
```

### Known limitations & solutions

| Challenge | Solution |
|---|---|
| **Image fills** — hashes are file-specific | Store image bytes in Supabase Storage. On reconstruct: download bytes → `figma.createImage(bytes)` → use new hash in fill. |
| **Fonts** — must be available locally | Call `figma.loadFontAsync()` before setting text. Catch errors, fall back to Inter, warn user about missing fonts. |
| **Variable bindings** — IDs are file-specific | Store variable name + collection name in snapshot. On reconstruct: look up by name in target file's variables. |
| **Library component refs** — instance swaps | Use `importComponentByKeyAsync(key)` to resolve library refs. Requires library to be enabled in the target file. |
| **Vector networks** — complex path data | `JSON_REST_V1` includes vector paths. Reconstruct via `VectorNode.vectorNetwork` setter. Works but complex boolean operations may need careful handling. |
| **Plugin data** — stored per-plugin | Use `setPluginData()` to restore any custom metadata. Namespace is plugin-specific, so same plugin ID required. |
| **Nested components** — instances within components | Reconstruct inner components first, then use `createInstance()` for nested refs. Topological sort needed. |

### Fidelity estimate

| Category | Fidelity | Notes |
|---|---|---|
| Structure/hierarchy | ~100% | JSON_REST_V1 captures the full tree |
| Colors/fills/gradients | ~100% | Direct property mapping |
| Auto-layout | ~100% | All layout props available |
| Text content + styles | ~95% | Font availability is the only risk |
| Component properties | ~100% | Full CRUD API available |
| Image fills | ~90% | Requires separate byte storage |
| Variable bindings | ~80% | Name-based matching, may miss renamed vars |
| Prototype interactions | ~70% | Reactions/transitions are readable but complex to restore |
| Vector paths | ~85% | VectorNetwork API works but complex paths need careful handling |

---

## 4. Plugin Architecture (for future implementation)

### Follows existing monorepo pattern

```
plugins/component-changelog/
├── manifest.json              # networkAccess for Supabase
├── code.ts                    # Sandbox: extraction + reconstruction
├── ui.tsx                     # React UI: history browser, diff viewer
├── types.ts                   # Shared message/data types
├── package.json               # @supabase/supabase-js, deep-diff, etc.
├── tsconfig.json              # ES2017, React JSX
└── inline-ui.js               # Build script (reuse existing pattern)
```

### Dependencies
- `@supabase/supabase-js` — Supabase client (in UI bundle)
- `deep-diff` or `jsondiffpatch` — JSON diffing
- `react`, `react-dom` — UI framework
- `@figma/plugin-typings` — Figma API types
- `@figma-plugins/shared-ui` — Shared component library (existing)
- `esbuild` — Bundler

### Data flow

```
[Figma Sandbox (code.ts)]          [UI iframe (ui.tsx)]           [Supabase]
        │                                  │                          │
        │──── component JSON ─────────────>│                          │
        │──── PNG thumbnail bytes ────────>│                          │
        │                                  │──── store snapshot ─────>│
        │                                  │<─── version history ─────│
        │                                  │<─── diff data ──────────│
        │<─── reconstruct request ─────────│                          │
        │     (JSON from Supabase)         │<─── fetch snapshot ─────│
        │──── reconstruction complete ────>│                          │
```

---

## 5. Implementation Phases (for when ready to build)

| Phase | Scope | Effort |
|---|---|---|
| **1. Extraction MVP** | Component discovery, JSON_REST_V1 export, UI preview | ~2-3 days |
| **2. Supabase Integration** | Schema setup, snapshot storage, version listing | ~3-4 days |
| **3. Changelog & Diff** | Diff engine, visual diff viewer, human-readable summaries | ~3-4 days |
| **4. Reconstruction** | JSON → ComponentNode builder, image/font handling | ~5-7 days |
| **5. Polish** | Variable tracking, bulk ops, export for CI/CD, search | ~3-5 days |

---

## 6. Potential Extensions

- **CI/CD integration**: Export component JSON for automated design token pipelines
- **Code generation**: Use stored JSON to generate React/SwiftUI/Compose components
- **Design review**: Compare "before" and "after" versions in PR-style reviews
- **Rollback**: One-click restoration of any previous component version
- **Cross-file sync**: Use stored JSON to propagate component changes across Figma files
- **Design system analytics**: Track how components evolve over time, detect drift
