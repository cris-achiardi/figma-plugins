# Figma Plugins Monorepo

A monorepo containing custom Figma plugins with a shared design system for consistent UI across all plugins.

## Monorepo Structure

```
Figma Plugins/
├── packages/
│   └── shared-ui/          # Shared React component library
│       ├── src/
│       │   ├── components/ # Button, Input, Dropdown, Select, Checkbox, etc.
│       │   ├── styles/     # Design tokens and theme
│       │   └── index.ts
│       └── package.json
├── plugins/
│   └── code-syntax-generator/  # Individual plugin
│       ├── manifest.json
│       ├── code.ts
│       ├── ui.tsx
│       └── package.json
├── package.json            # Root workspace configuration
└── README.md
```

## Shared UI Package

The `@figma-plugins/shared-ui` package provides a consistent design system for all plugins:

### Components
- **Button** - Primary, secondary, and tertiary variants
- **Input** - Text input with label and error states
- **Select** - Native dropdown with Figma styling (fallback option)
- **Dropdown** - Custom dropdown with fully styled menu and keyboard navigation
  - Fully customizable dropdown menu (not limited by browser defaults)
  - Keyboard navigation support (Enter, Space, Escape, Arrow keys)
  - Click-outside detection to close menu
  - Hover states for options
  - Figma-native styling throughout
- **Checkbox** - Custom checkbox with label
- **Modal** - Dialog component for overlays and information displays

### Design Tokens
- Colors based on Figma's official design language
- Typography (fonts, sizes, weights)
- Spacing scale
- Border radius
- Shadows and transitions
- **Dark Mode Support** - Automatic theme switching using Figma CSS variables

### Usage in Plugins

```tsx
import { Button, Input, Dropdown, Checkbox, Modal, theme } from '@figma-plugins/shared-ui';

function MyPlugin() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div>
      <Button variant="primary" onClick={handleClick}>
        Apply Changes
      </Button>
      <Input
        label="Name"
        value={name}
        onChange={e => setName(e.target.value)}
      />
      <Dropdown
        label="Options"
        value={selected}
        onChange={value => setSelected(value)}
        options={[
          { value: 'option1', label: 'Option 1' },
          { value: 'option2', label: 'Option 2' }
        ]}
      />
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="About"
      >
        <p>Your modal content here</p>
      </Modal>
    </div>
  );
}
```

## Plugins

### Code Syntax Generator

Programmatically add code syntax to Figma variables in bulk, eliminating manual entry for design tokens.

**Status:** ✅ Published on Figma Community
**Community Link:** https://www.figma.com/community/plugin/1580938580932953714
**Directory:** [plugins/code-syntax-generator](plugins/code-syntax-generator/)

**Features:**
- Bulk apply code syntax to all variables in a collection
- Support for multiple platforms (WEB, iOS, ANDROID)
- Customizable naming conventions (camelCase, snake_case, kebab-case, PascalCase)
- Optional prefix support with normalization (handles multi-word prefixes)
- Compound variable name normalization (e.g., "colorPrimary500" → "colorPrimary_500")
- Dark mode support with automatic theme detection
- Built with shared UI components for consistent design
- About modal with plugin information and support link

**Installation:**

For end users, run from the Figma Community:
1. Visit https://www.figma.com/community/plugin/1580938580932953714
2. Click "Run" to use it in your Figma files

**Development:**
```bash
# From root directory
npm install
npm run dev:code-syntax
```

Then in Figma Desktop:
1. Go to **Plugins** → **Development** → **Import plugin from manifest**
2. Select `plugins/code-syntax-generator/manifest.json`
3. Run the plugin from **Plugins** → **Development** → **Code Syntax Generator**

## Development

### Prerequisites
- Figma Desktop App (required for plugin development)
- Node.js >= 16.0.0
- npm >= 7.0.0 (for workspace support)
- VS Code (recommended)

### Getting Started

1. **Clone and install dependencies:**
   ```bash
   npm install
   ```
   This will install all dependencies and link the workspace packages automatically.

2. **Build the shared UI package:**
   ```bash
   npm run build:shared-ui
   ```

3. **Work on a plugin:**
   ```bash
   # Watch mode for development
   npm run dev:code-syntax
   ```

### Creating a New Plugin

1. **Create plugin directory:**
   ```bash
   mkdir plugins/my-new-plugin
   cd plugins/my-new-plugin
   ```

2. **Create manifest.json:**
   ```json
   {
     "name": "My New Plugin",
     "id": "unique-id",
     "api": "1.0.0",
     "main": "code.js",
     "ui": "ui.html",
     "editorType": ["figma"]
   }
   ```

3. **Create package.json:**
   ```json
   {
     "name": "my-new-plugin",
     "version": "1.0.0",
     "scripts": {
       "build": "npm run build:code && npm run build:ui && npm run inline-ui",
       "build:code": "esbuild code.ts --bundle --outfile=code.js --target=es2017",
       "build:ui": "esbuild ui.tsx --bundle --outfile=ui.js --target=es2017",
       "inline-ui": "node inline-ui.js"
     },
     "dependencies": {
       "@figma-plugins/shared-ui": "*",
       "react": "^18.2.0",
       "react-dom": "^18.2.0"
     },
     "devDependencies": {
       "@figma/plugin-typings": "^1.121.0",
       "@types/react": "^18.2.0",
       "@types/react-dom": "^18.2.0",
       "esbuild": "^0.27.1",
       "typescript": "^5.3.0"
     }
   }
   ```

4. **Create your plugin files:**
   - `code.ts` - Main plugin logic
   - `ui.tsx` - React UI using shared components
   - Copy `inline-ui.js` from code-syntax-generator
   - Copy `ui-template.html` from code-syntax-generator

5. **Install dependencies and build:**
   ```bash
   npm install
   npm run build
   ```

### Workspace Commands

From the root directory:

```bash
# Install all dependencies
npm install

# Build shared UI package
npm run build:shared-ui

# Build all plugins
npm run build:all-plugins

# Work on code-syntax-generator
npm run dev:code-syntax

# Work on a specific workspace
npm run build --workspace=@figma-plugins/shared-ui
npm run build --workspace=code-syntax-generator
```

### Plugin Structure

Each plugin follows this structure:

- `manifest.json` - Plugin configuration for Figma
- `code.ts` - Main plugin logic (runs in Figma sandbox)
- `ui.tsx` - React UI components
- `ui.html` - Generated UI file (built from template)
- `inline-ui.js` - Build script to inline JS into HTML
- `ui-template.html` - HTML template
- `package.json` - Dependencies and scripts
- `tsconfig.json` - TypeScript configuration

### Testing Plugins

1. Open Figma Desktop
2. Go to **Plugins** → **Development** → **Import plugin from manifest**
3. Select the plugin's `manifest.json` file
4. Run the plugin from **Plugins** → **Development** → **[Plugin Name]**

Changes to code will require rebuilding. Use watch mode during development.

## Shared UI Development

### Adding New Components

1. **Create component file:**
   ```bash
   cd packages/shared-ui/src/components
   # Create MyComponent.tsx
   ```

2. **Export from index:**
   ```typescript
   // packages/shared-ui/src/components/index.ts
   export { MyComponent } from './MyComponent';
   export type { MyComponentProps } from './MyComponent';
   ```

3. **Rebuild shared-ui:**
   ```bash
   npm run build:shared-ui
   ```

4. **Use in plugins:**
   ```tsx
   import { MyComponent } from '@figma-plugins/shared-ui';
   ```

### Design Tokens

Design tokens are defined in [packages/shared-ui/src/styles/tokens.ts](packages/shared-ui/src/styles/tokens.ts) and follow Figma's official design language:

- **Colors** - Primary, neutral, semantic, and special colors
- **Spacing** - Consistent spacing scale (xxs to xxl)
- **Typography** - Font families, sizes, weights, and line heights
- **Border Radius** - Consistent corner radius values
- **Shadows** - Box shadows for elevation
- **Transitions** - Animation timing functions

## Future Plugins

- Variable type converter
- Legacy migration tools
- Design token exporters
- Component generator

## Contributing

This is a personal monorepo. When adding new plugins:
1. Use the shared UI components for consistency
2. Follow the established directory structure
3. Use TypeScript for type safety
4. Include proper error handling
5. Document your plugin features in this README

## License

Personal project - All rights reserved
