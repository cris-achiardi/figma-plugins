# Code Syntax Generator

Programmatically add code syntax to Figma variables in bulk, eliminating manual entry for design tokens.

**Status:** ✅ Published on Figma Community
**Plugin Link:** https://www.figma.com/community/plugin/1580938580932953714

## Overview

This Figma plugin allows you to bulk apply code syntax to all variables in a collection, saving hours of manual work when setting up design tokens. Instead of manually entering code syntax for each variable, simply select your collection, choose your platform and naming convention, and let the plugin do the work.

## Features

### v2.0 - Template System
- **Template System** - Define custom code syntax with prefix + `{token}` + suffix pattern
  - Example: `tokens.` + `{token}` → `tokens.colorPrimary500`
  - Example: `$` + `{token}` + `-ios` → `$colorPrimary500-ios`
- **Per-Platform Configuration** - Independent templates and conventions for each platform
  - WEB, iOS, and ANDROID platforms with separate configurations
  - Each platform remembers its own template and naming convention
- **Platform Tabs** - Easy switching between platform configurations with visual states
- **Live Preview Panel** - See generated code syntax before applying
  - Default: Shows first 10 variables
  - Expandable: Click "Preview All" to see all variables
  - Scrollable when content exceeds panel height (fixed 300px)
- **LocalStorage Persistence** - Templates automatically saved per collection and platform
  - No need to re-enter templates when switching collections or reopening plugin

### Naming Conventions
- **camelCase** (e.g., `colorPrimary500`)
- **snake_case** (e.g., `color_primary_500`)
- **kebab-case** (e.g., `color-primary-500`)
- **PascalCase** (e.g., `ColorPrimary500`)

### Other Features
- **Remove Mode** - Dedicated workflow to remove code syntax from all variables
- **Two-Panel Layout** - Intuitive interface with configuration (left) and preview (right)
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

### Applying Code Syntax (v2.0)

1. Open a Figma file with variable collections
2. Run the plugin from **Plugins** → **Code Syntax Generator**
3. Select your variable collection from the dropdown
4. Choose your target platform using the tabs (WEB, iOS, ANDROID)
5. Enter your template with prefix and/or suffix around `{token}`:
   - Example: `tokens.{token}` for Web
   - Example: `${token}-ios` for iOS
   - Example: `theme_{token}` for Android
6. Select your preferred naming convention (camelCase, snake_case, kebab-case, PascalCase)
7. Preview the generated code syntax in the right panel
8. Click "Apply Template" to apply the code syntax to all variables
9. Templates are automatically saved per collection and platform

### Removing Code Syntax

1. Check "Remove code syntax from all variables in this collection"
2. Review the variables that will be affected in the preview panel
3. Click "Remove Code Syntax" to remove all code syntax

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

- **Button** - Primary and secondary action buttons
- **CustomInput** - Content-editable template input (bypasses Figma's default styling)
- **Dropdown** - Custom dropdown with keyboard navigation for collections and conventions
- **Tabs** - Platform switching with visual states
- **Checkbox** - Toggle options like "Remove mode"
- **Modal** - About dialog

All components support dark mode automatically via Figma CSS variables.

## Support

If you find this plugin helpful, consider [supporting the developer](https://buymeacoffee.com/crmoratelli).

## Version

Current version: 2.0.0

## License

Personal project - All rights reserved
