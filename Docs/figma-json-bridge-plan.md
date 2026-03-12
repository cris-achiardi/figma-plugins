# Figma JSON Bridge — Plugin + Claude Skill

## Concept

A lightweight Figma plugin that uses `JSON_REST_V1` as a bidirectional interchange format between Figma components and React code, paired with a Claude skill that understands the schema.

```
Figma Component ←→ JSON_REST_V1 ←→ React + CSS Modules
       ↑                                ↑
   Plugin API                      Claude Skill
  (export + reconstruct)        (knows the schema)
```

## Workflows

### 1. Design → Code
Designer mockups a component in Figma → plugin exports JSON → Claude skill generates vanilla React component with CSS Modules for prototyping.

### 2. Code → Design (iteration loop)
Developer prototypes a React component → Claude skill generates JSON_REST_V1 → plugin reconstructs Figma component for documentation or iteration → designer tweaks in Figma → re-exports JSON → changes sync back to React.

## Plugin Architecture

### What it does
- **Export**: Select component → `exportAsync({ format: 'JSON_REST_V1' })` + SVG injection → copy to clipboard or download
- **Import**: Paste JSON → `reconstructFromSnapshot()` → creates Figma component on canvas

### What it doesn't need
- No auth (OAuth or PAT)
- No Supabase / database
- No REST API calls
- No thumbnails or version tracking

### Code to reuse from component-changelog
| Source | What | Purpose |
|--------|------|---------|
| `code.ts` (lines ~75-134) | SVG collection + injection into snapshot | Enrich vectors with `_svgData` for lossless reconstruction |
| `code.ts` (lines ~125-145) | `exportAsync({ format: 'JSON_REST_V1' })` + property extraction | Core export logic |
| `reconstruct.ts` (~786 lines) | Full node reconstruction engine | JSON → Figma nodes |

### Reconstruction capabilities (from reconstruct.ts)
| Node Type | Method | Notes |
|-----------|--------|-------|
| FRAME | `figma.createFrame()` | Full auto-layout support |
| RECTANGLE | `figma.createRectangle()` | Corner radius per-corner |
| ELLIPSE | `figma.createEllipse()` | Basic shapes |
| TEXT | `figma.createText()` | Font loading + fallback to Inter |
| GROUP | `figma.group()` | Requires 2+ children |
| COMPONENT | `figma.createComponent()` | Full component creation |
| COMPONENT_SET | `figma.combineAsVariants()` | Variant grouping |
| VECTOR/STAR/POLYGON/LINE | `figma.createNodeFromSvg()` | Via `_svgData` property |
| INSTANCE | Downgraded to FRAME | Cannot link without original |

### Supported properties
- **Layout**: layoutMode, padding, itemSpacing, sizing modes, alignment
- **Visual**: fills (solid + gradients), strokes, effects (shadows, blurs), opacity, blend modes
- **Text**: fontFamily, fontSize, fontWeight, lineHeight, letterSpacing, alignment, decoration, textCase
- **Shape**: cornerRadius (uniform + per-corner), clipsContent
- **Component**: componentPropertyDefinitions, variant options

### Known limitations
- INSTANCE nodes downgraded to FRAME (no component link)
- IMAGE paints skipped (only hash in JSON, no bytes)
- Variable bindings not restored
- Boolean operations → placeholder or SVG fallback
- Unavailable fonts → Inter Regular fallback

## Claude Skill

### Purpose
Teach Claude the JSON_REST_V1 schema so it can:
1. **JSON → React**: Generate React + CSS Modules from exported Figma JSON
2. **React → JSON**: Generate valid JSON_REST_V1 from React components

### Skill contents
- Full JSON_REST_V1 schema reference (node types, properties, value formats)
- Color format: `{ r, g, b, a }` in 0-1 range
- Layout mapping: Figma auto-layout → CSS flexbox
- Naming conventions for variants (e.g., `"state=default, type=fill"`)
- Example mappings from real components (Button, Tooltip)

### Reference files
- `Docs/button-v2.1.1.json` — simple button (49 KB)
- `Docs/Button-v0.0.1.json` — full variant matrix (145 KB)
- `Docs/Button_base-v0.0.1.json` — base with nested components (1 MB)
- `Docs/Tooltip-v0.0.1.json` — medium complexity (109 KB)
- `workbench/` — proven React + CSS Modules output

## UI Wireframes

Plugin window size: ~320 x 400px (standard Figma plugin)

### Main View — Tab Navigation

```
┌──────────────────────────────────────┐
│  JSON Bridge                         │
├──────────────────────────────────────┤
│                                      │
│   ┌─────────────┐ ┌─────────────┐   │
│   │   EXPORT    │ │   IMPORT    │   │
│   │  (active)   │ │             │   │
│   └─────────────┘ └─────────────┘   │
│                                      │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  │
│         (tab content below)          │
│                                      │
└──────────────────────────────────────┘
```

### Export Tab — Nothing Selected

```
┌──────────────────────────────────────┐
│  JSON Bridge                         │
├──────────────────────────────────────┤
│   [ EXPORT ]    IMPORT               │
│  ──────────────────────────────────  │
│                                      │
│                                      │
│                                      │
│         ┌──────────────────┐         │
│         │   ◇  Select a    │         │
│         │   component or   │         │
│         │   component set  │         │
│         │   on the canvas  │         │
│         └──────────────────┘         │
│                                      │
│                                      │
│                                      │
└──────────────────────────────────────┘
```

### Export Tab — Component Selected

```
┌──────────────────────────────────────┐
│  JSON Bridge                         │
├──────────────────────────────────────┤
│   [ EXPORT ]    IMPORT               │
│  ──────────────────────────────────  │
│                                      │
│  ┌────────────────────────────────┐  │
│  │ ● Button                      │  │
│  │   COMPONENT_SET · 12 variants │  │
│  │   48 nodes · 6 vectors        │  │
│  └────────────────────────────────┘  │
│                                      │
│  Options                             │
│  ┌────────────────────────────────┐  │
│  │ ☑ Include SVG data            │  │
│  │ ☐ Include interactions        │  │
│  └────────────────────────────────┘  │
│                                      │
│  ┌────────────────────────────────┐  │
│  │        📋 Copy to Clipboard   │  │
│  └────────────────────────────────┘  │
│  ┌────────────────────────────────┐  │
│  │        💾 Save as .json       │  │
│  └────────────────────────────────┘  │
│                                      │
└──────────────────────────────────────┘
```

### Export Tab — Exporting (progress)

```
┌──────────────────────────────────────┐
│  JSON Bridge                         │
├──────────────────────────────────────┤
│   [ EXPORT ]    IMPORT               │
│  ──────────────────────────────────  │
│                                      │
│  ┌────────────────────────────────┐  │
│  │ ● Button                      │  │
│  │   COMPONENT_SET · 12 variants │  │
│  └────────────────────────────────┘  │
│                                      │
│  Exporting...                        │
│  ┌────────────────────────────────┐  │
│  │ ████████████░░░░░░░░  48/86   │  │
│  │ Collecting SVG data...        │  │
│  └────────────────────────────────┘  │
│                                      │
│                                      │
│                                      │
└──────────────────────────────────────┘
```

### Export Tab — Done

```
┌──────────────────────────────────────┐
│  JSON Bridge                         │
├──────────────────────────────────────┤
│   [ EXPORT ]    IMPORT               │
│  ──────────────────────────────────  │
│                                      │
│  ┌────────────────────────────────┐  │
│  │ ✓ Exported "Button"           │  │
│  │   145 KB · 86 nodes           │  │
│  │   Copied to clipboard         │  │
│  └────────────────────────────────┘  │
│                                      │
│  ┌────────────────────────────────┐  │
│  │        📋 Copy Again          │  │
│  └────────────────────────────────┘  │
│  ┌────────────────────────────────┐  │
│  │        💾 Save as .json       │  │
│  └────────────────────────────────┘  │
│                                      │
│                                      │
└──────────────────────────────────────┘
```

### Import Tab — Empty

```
┌──────────────────────────────────────┐
│  JSON Bridge                         │
├──────────────────────────────────────┤
│   EXPORT     [ IMPORT ]              │
│  ──────────────────────────────────  │
│                                      │
│  Paste JSON_REST_V1 snapshot         │
│  ┌────────────────────────────────┐  │
│  │                                │  │
│  │                                │  │
│  │   Paste or drop JSON here...   │  │
│  │                                │  │
│  │                                │  │
│  │                                │  │
│  │                                │  │
│  └────────────────────────────────┘  │
│                                      │
│  ── or ────────────────────────────  │
│                                      │
│  ┌────────────────────────────────┐  │
│  │     📂 Load from .json file   │  │
│  └────────────────────────────────┘  │
│                                      │
│  ┌────────────────────────────────┐  │
│  │     ▶ Reconstruct Component   │  │  (disabled)
│  └────────────────────────────────┘  │
│                                      │
└──────────────────────────────────────┘
```

### Import Tab — JSON Loaded

```
┌──────────────────────────────────────┐
│  JSON Bridge                         │
├──────────────────────────────────────┤
│   EXPORT     [ IMPORT ]              │
│  ──────────────────────────────────  │
│                                      │
│  ┌────────────────────────────────┐  │
│  │ { "document": {               │  │
│  │   "type": "COMPONENT_SET",    │  │
│  │   "name": "Button",           │  │
│  │   "children": [               │  │
│  │     { "type": "COMPONENT",    │  │
│  │       "name": "state=de...    │  │
│  └────────────────────────────────┘  │
│                                      │
│  ┌────────────────────────────────┐  │
│  │ ● Button                      │  │
│  │   COMPONENT_SET · 12 variants │  │
│  │   86 nodes detected           │  │
│  └────────────────────────────────┘  │
│                                      │
│  ┌────────────────────────────────┐  │
│  │     ▶ Reconstruct Component   │  │  (enabled)
│  └────────────────────────────────┘  │
│                                      │
└──────────────────────────────────────┘
```

### Import Tab — Reconstructing

```
┌──────────────────────────────────────┐
│  JSON Bridge                         │
├──────────────────────────────────────┤
│   EXPORT     [ IMPORT ]              │
│  ──────────────────────────────────  │
│                                      │
│  Reconstructing...                   │
│  ┌────────────────────────────────┐  │
│  │ ████████████████░░░░  68/86   │  │
│  │ Building text nodes...        │  │
│  └────────────────────────────────┘  │
│                                      │
│                                      │
└──────────────────────────────────────┘
```

### Import Tab — Done (with warnings)

```
┌──────────────────────────────────────┐
│  JSON Bridge                         │
├──────────────────────────────────────┤
│   EXPORT     [ IMPORT ]              │
│  ──────────────────────────────────  │
│                                      │
│  ┌────────────────────────────────┐  │
│  │ ✓ Reconstructed "Button"      │  │
│  │   86 nodes created            │  │
│  └────────────────────────────────┘  │
│                                      │
│  ⚠ 3 warnings                       │
│  ┌────────────────────────────────┐  │
│  │ • IconLeft: INSTANCE → Frame  │  │
│  │ • IconRight: INSTANCE → Frame │  │
│  │ • Font "Outfit" unavailable   │  │
│  │   → using Inter Regular       │  │
│  └────────────────────────────────┘  │
│                                      │
│  ┌────────────────────────────────┐  │
│  │     ▶ Import Another          │  │
│  └────────────────────────────────┘  │
│                                      │
└──────────────────────────────────────┘
```

## Why this beats Figma MCP
- **Accurate**: JSON_REST_V1 is Figma's own serialization — not a lossy interpretation
- **Complete**: variants, auto-layout, effects, interactions all captured
- **Offline**: Plugin API only, no network calls
- **Bidirectional**: same format in both directions
- **Simple**: no auth, no infra, just a clipboard and a skill
