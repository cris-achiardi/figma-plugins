# Code Syntax Generator

Programmatically add code syntax to Figma variables in bulk, eliminating manual entry for design tokens.

**Status:** ✅ Published on Figma Community
**Plugin Link:** https://www.figma.com/community/plugin/1580938580932953714

## Overview

This Figma plugin allows you to bulk apply code syntax to all variables in a collection, saving hours of manual work when setting up design tokens. Instead of manually entering code syntax for each variable, simply select your collection, choose your platform and naming convention, and let the plugin do the work.

## Features

- **Bulk Operations** - Apply code syntax to all variables in a collection at once
- **Multi-Platform Support** - WEB, iOS, and ANDROID platforms
- **Flexible Naming Conventions**:
  - camelCase (e.g., `colorPrimary500`)
  - snake_case (e.g., `color_primary_500`)
  - kebab-case (e.g., `color-primary-500`)
  - PascalCase (e.g., `ColorPrimary500`)
- **Prefix Normalization** - Optional prefix with intelligent normalization
  - Handles multi-word prefixes (e.g., "design tokens" becomes "designTokens")
  - Automatically applies selected naming convention to prefixes
- **Compound Variable Normalization** - Smart handling of compound names
  - Converts `colorPrimary500` → `colorPrimary_500`
  - Converts `spacingLg8` → `spacingLg_8`
  - Ensures consistent token structure
- **Dark Mode Support** - Automatic theme detection using Figma CSS variables
- **About Modal** - Plugin information and support link (Buy Me a Coffee)
- **Modern UI** - Built with shared component library for consistent Figma-native experience

## Installation

### For End Users

1. Visit the [plugin page on Figma Community](https://www.figma.com/community/plugin/1580938580932953714)
2. Click "Run" to use it in your Figma files
3. Select a variable collection and configure your preferences

### For Developers

1. Clone this monorepo
2. Install dependencies:
   ```bash
   npm install
   ```
3. Build or watch:
   ```bash
   npm run dev:code-syntax  # Watch mode
   npm run build           # One-time build
   ```
4. In Figma Desktop:
   - Go to **Plugins** → **Development** → **Import plugin from manifest**
   - Select `plugins/code-syntax-generator/manifest.json`
   - Run from **Plugins** → **Development** → **Code Syntax Generator**

## Usage

1. Open a Figma file with variable collections
2. Run the plugin from **Plugins** → **Code Syntax Generator**
3. Select your variable collection from the dropdown
4. Choose your target platform (WEB, iOS, ANDROID)
5. Select your preferred naming convention
6. (Optional) Add a prefix and enable normalization
7. (Optional) Enable compound variable normalization
8. Click "Generate Code Syntax"

## Development

### Tech Stack

- **TypeScript** - Type-safe plugin development
- **React** - UI components
- **esbuild** - Fast bundling
- **@figma-plugins/shared-ui** - Shared component library with dark mode support

### Project Structure

```
plugins/code-syntax-generator/
├── code.ts              # Main plugin logic (Figma sandbox)
├── ui.tsx               # React UI components
├── manifest.json        # Plugin configuration
├── package.json         # Dependencies and scripts
├── tsconfig.json        # TypeScript config
├── ui-template.html     # HTML template
├── inline-ui.js         # Build script
├── code.js              # Generated (bundled code)
├── ui.js                # Generated (bundled UI)
└── ui.html              # Generated (inlined HTML)
```

### Build Scripts

- `npm run build` - Full build (code + UI + inline)
- `npm run build:code` - Build plugin logic only
- `npm run build:ui` - Build UI only
- `npm run watch` - Watch mode for development

### How It Works

1. **Plugin Code (`code.ts`)** - Runs in Figma's sandbox environment
   - Accesses Figma API to read variable collections
   - Applies code syntax to variables based on user configuration
   - Communicates with UI via `figma.ui.postMessage()`

2. **UI (`ui.tsx`)** - Runs in iframe with React
   - Provides user interface using shared components
   - Sends configuration to plugin code via `parent.postMessage()`
   - Receives updates about variable collections

3. **Build Process**
   - TypeScript code is bundled with esbuild
   - React UI is bundled separately
   - UI JavaScript is inlined into HTML template
   - Single `ui.html` file contains all UI code

## Shared UI Components

This plugin uses the monorepo's shared UI library (`@figma-plugins/shared-ui`):

- **Button** - Primary action buttons
- **Dropdown** - Custom dropdown with keyboard navigation
- **Input** - Text input for prefix
- **Checkbox** - Toggle options
- **Modal** - About dialog

All components support dark mode automatically via Figma CSS variables.

## Support

If you find this plugin helpful, consider [supporting the developer](https://buymeacoffee.com/crmoratelli).

## Version

Current version: 1.0.0

## License

Personal project - All rights reserved
