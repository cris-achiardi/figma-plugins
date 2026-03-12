# Code Syntax Generator - ASCII Wireframes

> Plugin dimensions: **800 x 680px**
> Layout: CSS Grid — `340px | 1fr` columns, `1fr | auto` rows

---

## 1. Default State (No platforms selected)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                                                                              │
│  ┌─ LEFT PANEL (340px) ──────────┐  ┌─ RIGHT PANEL (flex) ─────────────────┐│
│  │                                │  │                                       ││
│  │  Variable Collection           │  │  [ Web ]  [ iOS ]  [ Android ]       ││
│  │  ┌──────────────────────────┐  │  │  (all disabled/dimmed)               ││
│  │  │ No collections found   ▼ │  │  │  ─────────────────────────────────── ││
│  │  └──────────────────────────┘  │  │                                       ││
│  │                                │  │  Custom Template                      ││
│  │  ┌ Platforms & Naming ───────┐ │  │                                       ││
│  │  │                           │ │  │  ┌──────────┐ ┌───────┐ ┌───┐        ││
│  │  │  ☐ Web                    │ │  │  │ var(--ds- │ │{token}│ │ ) │ [Apply]││
│  │  │                           │ │  │  └──────────┘ └───────┘ └───┘        ││
│  │  │  ☐ iOS                    │ │  │  (disabled)                           ││
│  │  │                           │ │  │                                       ││
│  │  │  ☐ Android                │ │  │  ☐ Omit parents (use only token name)││
│  │  │                           │ │  │                                       ││
│  │  └───────────────────────────┘ │  │  Preview (showing 0 of 0)            ││
│  │                                │  │  ┌─────────────────────────────────┐  ││
│  │  ─────────────────────────     │  │  │                                 │  ││
│  │                                │  │  │                                 │  ││
│  │  ☐ Remove code syntax from     │  │  │  Click "Apply Template" to      │  ││
│  │    selected collection         │  │  │  generate preview               │  ││
│  │                                │  │  │                                 │  ││
│  │                                │  │  │                                 │  ││
│  │                                │  │  └─────────────────────────────────┘  ││
│  │                                │  │                                       ││
│  │                                │  │  ┌─────────────────────────────────┐  ││
│  │                                │  │  │      Generate Code Syntax       │  ││
│  │                                │  │  └─────────────────────────────────┘  ││
│  │                                │  │  (disabled)                           ││
│  └────────────────────────────────┘  └───────────────────────────────────────┘│
│                                                                              │
│──────────────────────────────────────────────────────────────────────────────│
│  v2.0.0                                                                  (i)│
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Active State (Web platform selected, template applied)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                                                                              │
│  ┌─ LEFT PANEL ──────────────────┐  ┌─ RIGHT PANEL ────────────────────────┐│
│  │                                │  │                                       ││
│  │  Variable Collection           │  │  [•Web•]  [ iOS ]  [ Android ]       ││
│  │  ┌──────────────────────────┐  │  │   ▔▔▔▔▔   (dim)     (dim)           ││
│  │  │ Primitives             ▼ │  │  │  ─────────────────────────────────── ││
│  │  └──────────────────────────┘  │  │                                       ││
│  │                                │  │  Custom Template                      ││
│  │  ┌ Platforms & Naming ───────┐ │  │                                       ││
│  │  │                           │ │  │  ┌──────────┐ ┌───────┐ ┌───┐        ││
│  │  │  ☑ Web    [kebab-case ▼]  │ │  │  │ var(--ds-│ │{token}│ │ ) │ [Apply]││
│  │  │                           │ │  │  └──────────┘ └───────┘ └───┘        ││
│  │  │  ☐ iOS                    │ │  │                                       ││
│  │  │                           │ │  │  ☐ Omit parents (use only token name)││
│  │  │  ☐ Android                │ │  │                                       ││
│  │  │                           │ │  │  Preview (showing 10 of 145)  [All]  ││
│  │  └───────────────────────────┘ │  │  ┌─────────────────────────────────┐  ││
│  │                                │  │  │ var(--ds-color-moonstone-100)   │  ││
│  │  ─────────────────────────     │  │  │ var(--ds-color-moonstone-200)   │  ││
│  │                                │  │  │ var(--ds-color-moonstone-300)   │  ││
│  │  ☐ Remove code syntax from     │  │  │ var(--ds-color-red-50)         │  ││
│  │    selected collection         │  │  │ var(--ds-color-red-100)        │  ││
│  │                                │  │  │ var(--ds-color-red-200)        │  ││
│  │                                │  │  │ var(--ds-spacing-xs)           │  ││
│  │                                │  │  │ var(--ds-spacing-sm)           │  ││
│  │                                │  │  │ var(--ds-spacing-md)           │  ││
│  │                                │  │  │ var(--ds-spacing-lg)           │  ││
│  │                                │  │  └─────────────────────────────────┘  ││
│  │                                │  │                                       ││
│  │                                │  │  ┌─────────────────────────────────┐  ││
│  │                                │  │  │      Generate Code Syntax       │  ││
│  │                                │  │  └─────────────────────────────────┘  ││
│  └────────────────────────────────┘  └───────────────────────────────────────┘│
│                                                                              │
│──────────────────────────────────────────────────────────────────────────────│
│  v2.0.0                                                                  (i)│
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Multi-Platform State (Web + iOS active, iOS tab selected)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                                                                              │
│  ┌─ LEFT PANEL ──────────────────┐  ┌─ RIGHT PANEL ────────────────────────┐│
│  │                                │  │                                       ││
│  │  Variable Collection           │  │  [ Web ]  [•iOS•]  [ Android ]       ││
│  │  ┌──────────────────────────┐  │  │           ▔▔▔▔▔▔    (dim)           ││
│  │  │ Primitives             ▼ │  │  │  ─────────────────────────────────── ││
│  │  └──────────────────────────┘  │  │                                       ││
│  │                                │  │  Custom Template                      ││
│  │  ┌ Platforms & Naming ───────┐ │  │                                       ││
│  │  │                           │ │  │  ┌──────────┐ ┌───────┐ ┌───┐        ││
│  │  │  ☑ Web    [kebab-case ▼]  │ │  │  │ DS.      │ │{token}│ │   │ [Apply]││
│  │  │                           │ │  │  └──────────┘ └───────┘ └───┘        ││
│  │  │  ☑ iOS    [camelCase  ▼]  │ │  │                                       ││
│  │  │                           │ │  │  ☐ Omit parents (use only token name)││
│  │  │  ☐ Android                │ │  │                                       ││
│  │  │                           │ │  │  Preview (showing 10 of 145)  [All]  ││
│  │  └───────────────────────────┘ │  │  ┌─────────────────────────────────┐  ││
│  │                                │  │  │ DS.colorMoonstone100           │  ││
│  │  ─────────────────────────     │  │  │ DS.colorMoonstone200           │  ││
│  │                                │  │  │ DS.colorMoonstone300           │  ││
│  │  ☐ Remove code syntax from     │  │  │ DS.colorRed50                 │  ││
│  │    selected collection         │  │  │ DS.colorRed100                │  ││
│  │                                │  │  │ DS.colorRed200                │  ││
│  │                                │  │  │ DS.spacingXs                  │  ││
│  │                                │  │  │ DS.spacingSm                  │  ││
│  │                                │  │  │ DS.spacingMd                  │  ││
│  │                                │  │  │ DS.spacingLg                  │  ││
│  │                                │  │  └─────────────────────────────────┘  ││
│  │                                │  │                                       ││
│  │                                │  │  ┌─────────────────────────────────┐  ││
│  │                                │  │  │      Generate Code Syntax       │  ││
│  │                                │  │  └─────────────────────────────────┘  ││
│  └────────────────────────────────┘  └───────────────────────────────────────┘│
│                                                                              │
│──────────────────────────────────────────────────────────────────────────────│
│  v2.0.0                                                                  (i)│
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Existing Code Syntax Detected

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                                                                              │
│  ┌─ LEFT PANEL ──────────────────┐  ┌─ RIGHT PANEL ────────────────────────┐│
│  │                                │  │                                       ││
│  │  Variable Collection           │  │  [•Web•]  [ iOS ]  [ Android ]       ││
│  │  ┌──────────────────────────┐  │  │   ▔▔▔▔▔                             ││
│  │  │ Semantic                 ▼ │  │  │  ─────────────────────────────────── ││
│  │  └──────────────────────────┘  │  │                                       ││
│  │                                │  │  Custom Template                      ││
│  │  ┌ Platforms & Naming ───────┐ │  │                                       ││
│  │  │                           │ │  │  ┌──────────┐ ┌───────┐ ┌───┐        ││
│  │  │  ☑ Web    [kebab-case ▼]  │ │  │  │          │ │{token}│ │   │ [Apply]││
│  │  │                           │ │  │  └──────────┘ └───────┘ └───┘        ││
│  │  │  ☐ iOS                    │ │  │                                       ││
│  │  │                           │ │  │  ☐ Omit parents (use only token name)││
│  │  │  ☐ Android                │ │  │                                       ││
│  │  │                           │ │  │  Preview - Existing Code Syntax      ││
│  │  └───────────────────────────┘ │  │  ┌─────────────────────────────────┐  ││
│  │                                │  │  │ var(--ds-color-moonstone-100)   │  ││
│  │  ─────────────────────────     │  │  │ var(--ds-color-moonstone-200)   │  ││
│  │                                │  │  │ var(--ds-color-red-50)         │  ││
│  │  ☐ Remove code syntax from     │  │  │ var(--ds-color-red-100)        │  ││
│  │    selected collection         │  │  │ ...                            │  ││
│  │                                │  │  └─────────────────────────────────┘  ││
│  │                                │  │                                       ││
│  │                                │  │  ┌─────────────────────────────────┐  ││
│  │                                │  │  │ ℹ Showing existing code syntax. │  ││
│  │                                │  │  │   Edit template and click       │  ││
│  │                                │  │  │   "Apply Template" to preview   │  ││
│  │                                │  │  │   changes.                      │  ││
│  │                                │  │  └─────────────────────────────────┘  ││
│  │                                │  │                                       ││
│  │                                │  │  ┌─────────────────────────────────┐  ││
│  │                                │  │  │      Generate Code Syntax       │  ││
│  │                                │  │  └─────────────────────────────────┘  ││
│  └────────────────────────────────┘  └───────────────────────────────────────┘│
│                                                                              │
│──────────────────────────────────────────────────────────────────────────────│
│  v2.0.0                                                                  (i)│
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Remove Mode Active

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                                                                              │
│  ┌─ LEFT PANEL ──────────────────┐  ┌─ RIGHT PANEL ────────────────────────┐│
│  │                                │  │                                       ││
│  │  Variable Collection           │  │                                       ││
│  │  ┌──────────────────────────┐  │  │                                       ││
│  │  │ Primitives             ▼ │  │  │                                       ││
│  │  └──────────────────────────┘  │  │                                       ││
│  │                                │  │                                       ││
│  │  ┌ Platforms & Naming ───────┐ │  │                                       ││
│  │  │                           │ │  │        Remove Code Syntax             ││
│  │  │  ☑ Web    [kebab-case ▼]  │ │  │                                       ││
│  │  │                           │ │  │  This will remove code syntax from    ││
│  │  │  ☑ iOS    [camelCase  ▼]  │ │  │  all variables in the selected       ││
│  │  │                           │ │  │  collection for the checked           ││
│  │  │  ☐ Android                │ │  │  platforms.                           ││
│  │  │                           │ │  │                                       ││
│  │  └───────────────────────────┘ │  │  ┌─────────────────────────────────┐  ││
│  │                                │  │  │      Remove Code Syntax         │  ││
│  │  ─────────────────────────     │  │  └─────────────────────────────────┘  ││
│  │                                │  │                                       ││
│  │  ☑ Remove code syntax from     │  │                                       ││
│  │    selected collection         │  │                                       ││
│  │                                │  │                                       ││
│  │                                │  │                                       ││
│  │                                │  │                                       ││
│  └────────────────────────────────┘  └───────────────────────────────────────┘│
│                                                                              │
│──────────────────────────────────────────────────────────────────────────────│
│  v2.0.0                                                                  (i)│
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Success Status (after generation)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                                                                              │
│  ┌─ LEFT PANEL ──────────────────┐  ┌─ RIGHT PANEL ────────────────────────┐│
│  │                                │  │                                       ││
│  │  (same as active state)        │  │  [•Web•]  [•iOS•]  [ Android ]       ││
│  │                                │  │                                       ││
│  │                                │  │  ... (template + preview) ...         ││
│  │                                │  │                                       ││
│  │                                │  │  ┌─────────────────────────────────┐  ││
│  │                                │  │  │      Generate Code Syntax       │  ││
│  │                                │  │  └─────────────────────────────────┘  ││
│  │                                │  │                                       ││
│  │                                │  │  ┌─────────────────────────────────┐  ││
│  │                                │  │  │ ✓ Code syntax applied to 145    │  ││
│  │                                │  │  │   variables (Web, iOS)          │  ││
│  │                                │  │  └─────────────────────────────────┘  ││
│  │                                │  │  (green bg, green border)             ││
│  └────────────────────────────────┘  └───────────────────────────────────────┘│
│                                                                              │
│──────────────────────────────────────────────────────────────────────────────│
│  v2.0.0                                                                  (i)│
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 7. Error Status

```
                                       ┌───────────────────────────────────────┐
                                       │                                       │
                                       │  ... (right panel content) ...        │
                                       │                                       │
                                       │  ┌─────────────────────────────────┐  │
                                       │  │ Error: Please select at least   │  │
                                       │  │ one platform                    │  │
                                       │  └─────────────────────────────────┘  │
                                       │  (red bg, red border)                 │
                                       └───────────────────────────────────────┘
```

---

## 8. About Modal

```
                    ┌───────────────────────────────────────────┐
                    │  About Code Syntax Generator              │
                    │                                           │
                    │  This plugin allows you to add code       │
                    │  syntax to Figma variables in seconds.    │
                    │  Show the actual token name in dev mode   │
                    │  and superpower the Figma MCP with        │
                    │  machine readable metadata that AI can    │
                    │  use to consume your design system.       │
                    │                                           │
                    │  ─────────────────────────────────────    │
                    │                                           │
                    │  Created by:                              │
                    │  Cristian Morales Achiardi                │
                    │                                           │
                    │  [LinkedIn]  [GitHub]  [Website]          │
                    │                                           │
                    │  ☕ Buy Me a Coffee                       │
                    │                                           │
                    └───────────────────────────────────────────┘
```

---

## Component Anatomy

### Template Input Row

```
┌──────────────────┐  ┌─────────┐  ┌─────────┐  ┌──────────────┐
│  prefix input    │  │ {token} │  │ suffix  │  │ Apply        │
│  (CustomInput)   │  │  chip   │  │ input   │  │ Template     │
│  flex: 1         │  │ (label) │  │ 50px    │  │ (Button)     │
└──────────────────┘  └─────────┘  └─────────┘  └──────────────┘
     mono font         gray800       mono font      primary btn
                       semibold
```

### Platform Row (inside fieldset)

```
┌──────────────────────────────────────────────────────────┐
│  ┌────┐                                                  │
│  │ ☑  │  Web                          [kebab-case    ▼]  │
│  └────┘                               (140px dropdown)   │
│  (Checkbox)                                              │
│                                                          │
│  ┌────┐                                                  │
│  │ ☑  │  iOS                          [camelCase     ▼]  │
│  └────┘                               (shows when ☑)     │
│                                                          │
│  ┌────┐                                                  │
│  │ ☐  │  Android                                         │
│  └────┘                               (hidden when ☐)    │
└──────────────────────────────────────────────────────────┘
```

### Platform Tabs

```
  ┌───────┐  ┌───────┐  ┌──────────┐
  │  Web  │  │  iOS  │  │ Android  │
  ╞═══════╡  └───────┘  └──────────┘
  (active)   (enabled)   (disabled)
   blue       default     dimmed
   bold       clickable   opacity 0.5
   border-b               cursor: not-allowed
```

### Preview Panel

```
  Preview (showing 10 of 145)            [Preview All]
  ┌────────────────────────────────────────────────────┐
  │  var(--ds-color-moonstone-100)                     │  ← mono font
  │  var(--ds-color-moonstone-200)                     │    bgSecondary
  │  var(--ds-color-moonstone-300)                     │    250px height
  │  var(--ds-color-red-50)                            │    overflow-y: auto
  │  var(--ds-color-red-100)                           │
  │  var(--ds-color-red-200)                           │
  │  var(--ds-spacing-xs)                              │
  │  var(--ds-spacing-sm)                              │
  │  var(--ds-spacing-md)                              │
  │  var(--ds-spacing-lg)                              │
  └────────────────────────────────────────────────────┘
```

### Footer

```
  ──────────────────────────────────────────────────────────
  v2.0.0                                               (i)
                                                   info btn
                                                   24x24
```

---

## Grid Layout Reference

```
  gridTemplateColumns: '340px 1fr'
  gridTemplateRows: '1fr auto'

  ┌───────────────────┬────────────────────────────────────┐
  │                   │                                    │
  │   LEFT PANEL      │   RIGHT PANEL                      │
  │   col 1           │   col 2                            │
  │   row 1           │   row 1                            │
  │   borderRight     │                                    │
  │   overflow-y      │   overflow-y                       │
  │                   │                                    │
  ├───────────────────┴────────────────────────────────────┤
  │   FOOTER  (gridColumn: 1 / -1)                        │
  │   row 2 — borderTop                                   │
  └────────────────────────────────────────────────────────┘
```

---

## State Machine

```
                     ┌──────────────┐
                     │   INITIAL    │
                     │  no platform │
                     │  selected    │
                     └──────┬───────┘
                            │
                   check platform(s)
                            │
                            ▼
                     ┌──────────────┐
               ┌─────│   GENERATE   │─────┐
               │     │    MODE      │     │
               │     └──────┬───────┘     │
               │            │             │
         check remove    Apply         Generate
          checkbox      Template       Code Syntax
               │            │             │
               ▼            ▼             ▼
        ┌──────────┐  ┌──────────┐  ┌──────────┐
        │  REMOVE  │  │ PREVIEW  │  │ SUCCESS  │
        │  MODE    │  │ SHOWN    │  │ STATUS   │
        └──────────┘  └──────────┘  └──────────┘
               │            │
           Remove      Toggle expand
               │            │
               ▼            ▼
        ┌──────────┐  ┌──────────┐
        │ SUCCESS  │  │ EXPANDED │
        │ (remove) │  │ PREVIEW  │
        └──────────┘  └──────────┘
```

---

## Message Flow

```
  ┌──────────────┐                         ┌──────────────┐
  │   ui.tsx      │                         │   code.ts     │
  │   (React)     │                         │   (Sandbox)   │
  └───────┬───────┘                         └───────┬───────┘
          │                                         │
          │──── get-collections ───────────────────>│
          │                                         │
          │<──── collections-list ─────────────────│
          │                                         │
          │──── load-collection ──────────────────>│
          │                                         │
          │<──── existing-syntax-found ────────────│
          │                                         │
          │──── generate-preview ─────────────────>│
          │      {platform, convention,             │
          │       prefix, suffix,                   │
          │       omitParents, limit}               │
          │                                         │
          │<──── preview-result ───────────────────│
          │      {platform, previews[], total}      │
          │                                         │
          │──── apply-code-syntax ────────────────>│
          │      {platforms[], conventions,          │
          │       prefixes, suffixes, omitParents}  │
          │                                         │
          │<──── apply-complete ───────────────────│
          │      {count, platforms[]}               │
          │                                         │
          │──── remove-code-syntax ───────────────>│
          │      {platforms[]}                      │
          │                                         │
          │<──── remove-complete ──────────────────│
          │      {count, platforms[]}               │
          │                                         │
          │<──── error ────────────────────────────│
          │      {message}                          │
          ▼                                         ▼
```
