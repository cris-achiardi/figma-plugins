# DS Adoption Tracker

A Figma plugin for Design System specialists to measure component adoption across Figma files.

## Features

- **Instance Counting**: Count component instances by scope (current page, file, or selection)
- **Dependency Tracking**: Track nested component relationships for atomic design level analysis
- **Detached Detection**: Identify frames that were disconnected from their source components
- **Export**: Export data as JSON or CSV for reporting and analysis

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
- Summary statistics
- Component list with instance counts
- Detached instances
- Dependency graph

### CSV

Three separate files:
- `*-components.csv`: Component data
- `*-detached.csv`: Detached instances
- `*-summary.csv`: Summary metrics

## Tech Stack

- TypeScript
- React 18
- esbuild
- @figma-plugins/shared-ui (monorepo shared components)

## Author

Cristian Morales Achiardi
