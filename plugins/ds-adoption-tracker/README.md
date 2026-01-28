# DS Adoption Tracker

A Figma plugin for Design System specialists to measure component adoption across Figma files.

## Features

- **Instance Counting**: Count component instances by scope (current page, file, or selection)
- **Variant Grouping**: Components grouped by base name (e.g., "Button / Primary" and "Button / Secondary" grouped under "Button") with expand/collapse to see variant breakdown
- **Instance Navigation**: Click through component instances directly in the canvas at both group and variant level
- **Dependency Tracking**: Track nested component relationships for atomic design level analysis
- **Detached Detection**: Identify frames that were disconnected from their source components
- **Export**: Export data as JSON or CSV for reporting and analysis
- **Dark Mode Support**: Automatic theme detection using Figma CSS variables

## Development

### Prerequisites

- Node.js 18+
- npm 9+

### Setup

From the monorepo root:

```bash
npm install
```

### Commands

Build the plugin:

```powershell
cd plugins/ds-adoption-tracker
npm run build
```

Or from the monorepo root:

```bash
npm run build -w ds-adoption-tracker
```

### Build Scripts

| Command | Description |
|---------|-------------|
| `npm run build` | Full build (code + UI + inline) |
| `npm run build:code` | Build plugin sandbox code only |
| `npm run build:ui` | Build React UI only |
| `npm run inline-ui` | Inline JS into HTML |
| `npm run watch` | Watch mode for development |

### Project Structure

```
ds-adoption-tracker/
├── code.ts          # Figma plugin sandbox code
├── ui.tsx           # React UI components
├── types.ts         # Shared TypeScript types
├── inline-ui.js     # Build script to inline JS into HTML
├── manifest.json    # Figma plugin manifest
├── package.json     # Dependencies and scripts
└── README.md        # This file
```

## Usage

1. Open Figma and run the plugin from Plugins menu
2. Select a scope:
   - **Current Page**: Analyze the active page
   - **Current File**: Analyze all pages in the file
   - **Selected Frames**: Analyze only selected frames
3. Click **Analyze** to scan for component instances
4. View results in the **Instances** or **Detached** tabs
5. Export data as **JSON** or **CSV**

## Export Formats

### JSON

Single file containing:
- Metadata (plugin version, timestamp, scope)
- Summary statistics (instances, components, variants, from libraries, detached)
- Grouped components with nested variants
- Dependency graph

```json
{
  "summary": {
    "totalInstances": 847,
    "components": 15,
    "totalVariants": 45,
    "fromLibraries": 12,
    "localComponents": 3,
    "detachedInstances": 2
  },
  "components": [
    {
      "name": "Button",
      "totalInstances": 50,
      "variantCount": 3,
      "fromLibrary": true,
      "variants": [
        { "name": "Button / Primary", "instanceCount": 40 },
        { "name": "Button / Secondary", "instanceCount": 8 },
        { "name": "Button / Tertiary", "instanceCount": 2 }
      ]
    }
  ]
}
```

### CSV

Single file with grouped component data:
- `name`: Base component name
- `totalInstances`: Sum across all variants
- `variantCount`: Number of variants
- `fromLibrary`: Whether component is from a library
- `libraryName`: Source library name
- `variants`: Semicolon-separated list of variants with counts

## Tech Stack

- TypeScript
- React 18
- esbuild
- @figma-plugins/shared-ui (monorepo shared components)

## Author

Cristian Morales Achiardi
