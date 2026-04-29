# Component Spec

A Figma plugin that emits a compact, plain-text spec of a component's API — designed to be pasted into an LLM as context for generating code.

Most Figma-to-code tools produce verbose JSON or pixel-perfect HTML. Neither is a good fit when you want an AI to write *new* code that matches an existing design system. This plugin produces output that is small enough to fit comfortably in a prompt, structured enough for the model to reason about, and tied directly to your design tokens.

## What you get

A single text blob per component, shaped roughly like this:

```
Button
COMPONENT SET

Properties:
  Variant: primary | secondary | ghost
  Size: sm | md | lg
  Disabled: boolean
  Icon: instance-swap
  Variants: 18

---

Base: Variant=primary, Size=md, Disabled=false

Button
  width: hug
  height: hug
  display: flex
  align-items: center
  gap: var(--space-sm, 8px)
  padding: var(--space-md, 12px) var(--space-lg, 16px)
  border-radius: var(--radius-md, 6px)
  background: var(--color-accent, #10B981)

  Label
    font-family: Inter
    font-weight: 500
    font-size: var(--text-sm, 14px)
    color: var(--color-on-accent, #FFFFFF)

---

Variant changes:

Variant=secondary:
  (root): background → var(--color-surface, #1F1F1F), border → 1px solid var(--color-border, #2A2A2A)
  Label: color → var(--color-text, #FAFAFA)

Variant=ghost:
  (root): background → transparent
  Label: color → var(--color-accent, #10B981)

Size=sm:
  (root): padding → var(--space-sm, 8px) var(--space-md, 12px)
  Label: font-size → var(--text-xs, 12px)

Disabled=true:
  (root): opacity → 50%
```

## Why this format

- **CSS-flavored syntax** — LLMs have seen orders of magnitude more CSS than Figma JSON. Property names like `padding`, `border-radius`, `font-weight` map directly to the code the model needs to write.
- **Tokens are first-class** — every value bound to a Figma variable becomes `var(--token-name, raw-fallback)`. The model sees both the token to use and the resolved value to sanity-check against.
- **Variant diffs, not duplicates** — for a component set, one variant is dumped in full and the rest are encoded as deltas from that base, grouped by which variant property changed. A 30-variant Button collapses from ~30 full trees to one tree plus a few lines per dimension.
- **Instances are references** — when the tree contains an instance of another component, only the source component name and its `componentProperties` (variant selection, booleans, text, instance-swap) are emitted. Children are not inflated. You extract the source component separately and the model cross-links them.
- **No coordinates, no node IDs, no IDs of any kind** — only what's needed to reproduce the visual + behavioral contract.

## How it works

### Output structure

For any selected node:

1. **Header** — name and type. For non-component-set nodes, also `width × height`.
2. **Properties block** (component / component set only) — variant dimensions with their options, booleans, text props, and instance-swap slots. For component sets, also the variant count.
3. **Body**:
   - **Component set** → base variant tree + variant-change deltas (see below).
   - **Anything else** → indented tree dump of the node and its descendants.

### Variant diffing

When you export a `COMPONENT_SET`:

1. The first variant is picked as the base. Its full tree is emitted.
2. For each variant dimension (e.g. `Size`, `Variant`, `State`), the plugin finds the variant that differs from the base in *only* that dimension and computes a per-node delta.
3. Each changed node is emitted as one line: `<path>: <prop> → <value>, <prop> → <value>`. Added or removed nodes are marked `[added]` / `[removed]`.
4. **Sibling collapsing** — if multiple sibling nodes (e.g. `Cells#1`, `Cells#2`, `Cells#3`) all change in identical ways for a given variant, they collapse to a single pattern entry `Cells[*]: …`. If they differ, the original paths are preserved.

This handles the common case where, for instance, going from `Variant=primary` to `Variant=secondary` changes only the root background and the label color — the diff is two lines instead of a duplicated tree.

### Per-node properties

Each node emits a flat list of CSS-like properties:

| Group        | Properties                                                                                           |
| ------------ | ---------------------------------------------------------------------------------------------------- |
| Size         | `width`, `height` — `hug` / `fill` / px                                                              |
| Layout       | `display: flex`, `flex-direction`, `flex-wrap`, `justify-content`, `align-items`, `gap`, `padding`   |
| Appearance   | `border-radius`, `border`, `background`, `opacity`, `box-shadow`, `filter`, `backdrop-filter`        |
| Text         | `font-family`, `font-weight`, `font-style`, `font-size`, `line-height`, `letter-spacing`, `text-align`, `color` |
| Instance ref | `instance: <component-name>`, plus one entry per `componentProperty` (e.g. `.Variant: primary`)      |

Padding uses shorthand when uniform and unbinds to per-side props when individual sides bind to different variables. Border radius does the same for mixed corners.

### Variable resolution

Every prop that is bound to a Figma variable is rewritten as:

```
var(--<token-name>, <raw-value>)
```

`<token-name>` is the variable's collection path with `/` replaced by `-` (so `color/surface/default` becomes `color-surface-default`). The raw fallback is the resolved px / hex / number, so the output remains useful even if the consumer ignores the token. Variables are resolved asynchronously and cached for the duration of an export.

### Instance handling

Instances are deliberately opaque. Walking into them would explode the output and recreate information the model already has from the source component's own export. Instead, an instance node emits:

```
instance: <source-component-or-set-name>
.Variant: primary
.Size: md
.Disabled: false
.Icon#1: <node-id-or-name>
```

Property names are stripped of Figma's internal `#nodeId:offset` suffix. When that strip produces collisions (e.g. four `INSTANCE_SWAP` props all named `Cells`), they're disambiguated as `.Cells#1`, `.Cells#2`, etc.

## UI

- Select a single node → the panel shows its name, type, dimensions, child count, and (for component sets) variant count.
- **Export Properties** kicks off the pipeline with a progress bar.
- **Copy to Clipboard** / **Save as File** (`<name>.txt`) when finished.
- **Show Preview** to inspect the output inline.
- The window is vertically resizable from a handle at the bottom.

## Files

- `code.ts` — Figma sandbox: selection tracking, prop extraction, variant diffing, plain-text rendering.
- `ui.tsx` — React UI (one tab: Export). Compiled to `ui.js` and inlined into `ui.html`.
- `reconstruct.ts` — JSON_REST_V1 → Figma node rebuilder. Wired through `handleImport` in `code.ts` but not currently exposed in the UI.
- `inline-ui.js` — Build-time step: reads `ui.js`, escapes `</`, and inlines it into the HTML template (which carries the dark-theme CSS tokens and the resize handle).
- `types.ts` — Discriminated unions for `UIMessage` / `CodeMessage` and `SelectionInfo`.
- `manifest.json` — `documentAccess: dynamic-page` (needed for variable resolution and main-component lookups across pages), `networkAccess: none`.

## Build

```bash
npm install
npm run build
```

Produces `code.js` and `ui.html` (with the React bundle inlined). Load the plugin in Figma via **Plugins → Development → Import plugin from manifest…** pointing at `manifest.json`.

There is no watch script; rerun `npm run build` after each change.

## Limitations

- **One node at a time.** Multi-selection is rejected with an error.
- **Component-set base is the first variant.** If your variant ordering puts an outlier first, the diffs will be larger than necessary.
- **Images, gradients, and complex paints** collapse to literal strings (`image`, `gradient`) — the model doesn't get the underlying data.
- **Reconstruction is dormant.** The import path exists in code but the UI tab is not wired in `App`.
