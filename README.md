# Figma Plugins

A monorepo containing custom Figma plugins for design systems and workflow automation.

## Plugins

### Code Syntax Generator

Programmatically add code syntax to Figma variables in bulk, eliminating manual entry for design tokens.

**Directory:** `Code Syntax Generator/`

**Features:**
- Bulk apply code syntax to all variables in a collection
- Support for multiple platforms (WEB, iOS, ANDROID)
- Customizable naming conventions (camelCase, snake_case, kebab-case, PascalCase)
- Optional prefix support for design system tokens

**Quick Start:**
```bash
cd "Code Syntax Generator"
npm install
npm run watch
```

Then in Figma Desktop:
1. Go to **Plugins** → **Development** → **Code Syntax Generator**
2. Select your variable collection
3. Choose platforms and naming conventions
4. Click "Apply Code Syntax"

## Monorepo Structure

Each plugin is self-contained with its own:
- `manifest.json` - Plugin configuration
- `code.ts` - Main plugin logic (runs in Figma sandbox)
- `ui.html` - UI shell
- `ui.tsx` - React UI components
- `package.json` - Dependencies
- `tsconfig.json` - TypeScript configuration

## Development

### Prerequisites
- Figma Desktop App (required for plugin development)
- Node.js & npm
- VS Code (recommended)

### Creating a New Plugin

1. Open Figma Desktop
2. Go to **Plugins** → **Development** → **New Plugin**
3. Select **Figma design** and **Custom UI**
4. Save to this repository's root directory
5. Install dependencies: `npm install`
6. Start development: `npm run watch`

### Testing

Run plugins via **Plugins** → **Development** in Figma Desktop. Changes to code will hot reload.

## Future Plugins

- Variable type converter
- Legacy migration tools
- Design token exporters

## Contributing

This is a personal monorepo. Each plugin should follow the established structure and naming conventions.
