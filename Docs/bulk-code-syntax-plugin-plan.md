# Bulk Code Syntax Plugin - Implementation Plan

**Plugin Purpose:** Programmatically add code syntax to Figma variables in bulk, eliminating manual entry for design tokens.

**Problem Solved:** When you have 100+ variables in a collection, manually adding code syntax (WEB, iOS, ANDROID) for each is tedious. This automates the entire process.

---

## Repo Structure

**Monorepo approach** - keep all related plugins together:

```
figma-plugins/
├── README.md
├── bulk-code-syntax/
│   ├── manifest.json
│   ├── code.ts              # Plugin logic (sandbox)
│   ├── ui.html              # UI shell
│   ├── ui.tsx               # React UI code
│   ├── ui.js                # Compiled from ui.tsx
│   ├── tsconfig.json
│   └── package.json
├── variable-type-converter/ # Future plugin
└── legacy-migration/        # Future plugin
```

Each plugin is self-contained with its own manifest.json. No need for separate repos.

---

## Prerequisites

**One-time setup:**
- Figma Desktop App (required for plugin development)
- Node.js & npm (you have this)
- VS Code (you have this)

**Per plugin:**
- Create plugin via Figma Desktop (generates boilerplate)
- Install dependencies
- Start TypeScript watch mode

---

## User Flow

1. User opens plugin in Figma
2. Plugin UI displays:
   - **Collection selector** (dropdown of all local variable collections)
   - **Platform checkboxes:** WEB, iOS, ANDROID
   - **Naming convention selector** per platform (camelCase, snake_case, kebab-case, PascalCase)
   - **Optional prefix** input (e.g., "ds" → `dsBackgroundPrimary`)
   - **Apply button**
3. Plugin processes all variables in selected collection
4. Shows completion summary: "✓ Updated 147 variables with code syntax"

---

## Plugin Architecture

Figma plugins use a dual-process model:

**code.ts** - Runs in Figma's sandbox (no DOM access, full Plugin API access)
**ui.html/tsx** - Runs in iframe (has DOM, no direct Plugin API access)

Communication between them uses `postMessage`.

---

## Implementation

### 1. code.ts (Plugin Logic)

Main logic that interacts with Figma's API:

```typescript
// Show UI with specified dimensions
figma.showUI(__html__, { width: 400, height: 500 });

// Listen for messages from UI
figma.ui.onmessage = async (msg) => {
  if (msg.type === 'get-collections') {
    // Get all local variable collections
    const collections = figma.variables.getLocalVariableCollections();
    
    // Send back to UI
    figma.ui.postMessage({
      type: 'collections-list',
      collections: collections.map(c => ({ 
        id: c.id, 
        name: c.name 
      }))
    });
  }
  
  if (msg.type === 'apply-code-syntax') {
    const { collectionId, platforms, conventions, prefix } = msg;
    
    // Get the selected collection
    const collection = figma.variables.getVariableCollectionById(collectionId);
    if (!collection) {
      figma.ui.postMessage({ type: 'error', message: 'Collection not found' });
      return;
    }
    
    // Get all variables in the collection
    const variables = collection.variableIds.map(id => 
      figma.variables.getVariableById(id)
    ).filter(v => v !== null);
    
    // Process each variable
    let updated = 0;
    for (const variable of variables) {
      const codeSyntax = buildCodeSyntax(variable, platforms, conventions, prefix);
      variable.codeSyntax = codeSyntax;
      updated++;
    }
    
    figma.ui.postMessage({
      type: 'complete',
      count: updated
    });
  }
};

/**
 * Build code syntax object for a variable
 */
function buildCodeSyntax(
  variable: Variable,
  platforms: string[],
  conventions: Record<string, string>,
  prefix: string
): Record<string, string> {
  // Parse variable path from hierarchical name
  // Figma variables use "/" as separator: "background/primary/default"
  const path = variable.name.split('/');
  
  const syntax: Record<string, string> = {};
  
  for (const platform of platforms) {
    const convention = conventions[platform];
    syntax[platform] = formatPath(path, convention, prefix);
  }
  
  return syntax;
}

/**
 * Format path parts according to naming convention
 */
function formatPath(
  parts: string[],
  convention: string,
  prefix: string
): string {
  let formatted = '';
  
  switch (convention) {
    case 'camelCase':
      // background/primary/default → backgroundPrimaryDefault
      formatted = parts
        .map((p, i) => i === 0 ? p.toLowerCase() : capitalize(p))
        .join('');
      break;
      
    case 'snake_case':
      // background/primary/default → background_primary_default
      formatted = parts.map(p => p.toLowerCase()).join('_');
      break;
      
    case 'kebab-case':
      // background/primary/default → background-primary-default
      formatted = parts.map(p => p.toLowerCase()).join('-');
      break;
      
    case 'PascalCase':
      // background/primary/default → BackgroundPrimaryDefault
      formatted = parts.map(capitalize).join('');
      break;
  }
  
  // Add prefix if provided
  if (prefix) {
    // For camelCase with prefix, capitalize first letter after prefix
    if (convention === 'camelCase') {
      formatted = prefix + capitalize(formatted);
    } else if (convention === 'PascalCase') {
      formatted = capitalize(prefix) + formatted;
    } else {
      // For snake_case and kebab-case, just prepend with separator
      const separator = convention === 'snake_case' ? '_' : '-';
      formatted = `${prefix}${separator}${formatted}`;
    }
  }
  
  return formatted;
}

/**
 * Capitalize first letter of string
 */
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}
```

### 2. ui.html (UI Shell)

Minimal HTML wrapper:

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * {
      box-sizing: border-box;
    }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      font-size: 12px;
      padding: 16px;
      margin: 0;
      color: #000;
    }
    h2 {
      font-size: 14px;
      font-weight: 600;
      margin: 0 0 16px 0;
    }
    label {
      display: block;
      margin-bottom: 12px;
      font-weight: 500;
    }
    select, input {
      width: 100%;
      padding: 6px 8px;
      margin-top: 4px;
      border: 1px solid #ccc;
      border-radius: 4px;
      font-size: 12px;
    }
    fieldset {
      border: 1px solid #e0e0e0;
      border-radius: 4px;
      padding: 12px;
      margin-bottom: 12px;
    }
    legend {
      font-weight: 600;
      padding: 0 4px;
    }
    .platform-option {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
    }
    .platform-option input[type="checkbox"] {
      width: auto;
      margin: 0;
    }
    .platform-option select {
      flex: 1;
      margin: 0;
    }
    button {
      width: 100%;
      padding: 8px 16px;
      background: #18A0FB;
      color: white;
      border: none;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      margin-top: 8px;
    }
    button:hover {
      background: #0D8FE8;
    }
    button:disabled {
      background: #ccc;
      cursor: not-allowed;
    }
    .status {
      margin-top: 12px;
      padding: 8px;
      border-radius: 4px;
      font-size: 11px;
    }
    .status.success {
      background: #E7F5EC;
      color: #0D612B;
    }
    .status.processing {
      background: #E7F1FF;
      color: #0D5FBF;
    }
    .status.error {
      background: #FFE7E7;
      color: #BF0D0D;
    }
  </style>
</head>
<body>
  <div id="root"></div>
  <script src="ui.js"></script>
</body>
</html>
```

### 3. ui.tsx (React UI)

```typescript
import * as React from 'react';
import { createRoot } from 'react-dom/client';

interface Collection {
  id: string;
  name: string;
}

type Platform = 'WEB' | 'iOS' | 'ANDROID';
type NamingConvention = 'camelCase' | 'snake_case' | 'kebab-case' | 'PascalCase';

function App() {
  const [collections, setCollections] = React.useState<Collection[]>([]);
  const [selectedCollection, setSelectedCollection] = React.useState('');
  const [platforms, setPlatforms] = React.useState<Record<Platform, boolean>>({
    WEB: true,
    iOS: false,
    ANDROID: false
  });
  const [conventions, setConventions] = React.useState<Record<Platform, NamingConvention>>({
    WEB: 'camelCase',
    iOS: 'camelCase',
    ANDROID: 'snake_case'
  });
  const [prefix, setPrefix] = React.useState('');
  const [status, setStatus] = React.useState<{
    type: 'success' | 'processing' | 'error' | null;
    message: string;
  }>({ type: null, message: '' });

  React.useEffect(() => {
    // Request collections list on mount
    parent.postMessage({ pluginMessage: { type: 'get-collections' } }, '*');
    
    // Listen for messages from plugin
    window.onmessage = (event) => {
      const msg = event.data.pluginMessage;
      
      if (msg.type === 'collections-list') {
        setCollections(msg.collections);
        // Auto-select first collection if available
        if (msg.collections.length > 0) {
          setSelectedCollection(msg.collections[0].id);
        }
      }
      
      if (msg.type === 'complete') {
        setStatus({
          type: 'success',
          message: `✓ Updated ${msg.count} variables with code syntax`
        });
      }
      
      if (msg.type === 'error') {
        setStatus({
          type: 'error',
          message: `Error: ${msg.message}`
        });
      }
    };
  }, []);

  const handlePlatformToggle = (platform: Platform) => {
    setPlatforms(prev => ({
      ...prev,
      [platform]: !prev[platform]
    }));
  };

  const handleConventionChange = (platform: Platform, convention: NamingConvention) => {
    setConventions(prev => ({
      ...prev,
      [platform]: convention
    }));
  };

  const handleApply = () => {
    // Get enabled platforms
    const enabledPlatforms = (Object.keys(platforms) as Platform[])
      .filter(platform => platforms[platform]);
    
    if (enabledPlatforms.length === 0) {
      setStatus({
        type: 'error',
        message: 'Please select at least one platform'
      });
      return;
    }
    
    // Send message to plugin
    parent.postMessage({
      pluginMessage: {
        type: 'apply-code-syntax',
        collectionId: selectedCollection,
        platforms: enabledPlatforms,
        conventions,
        prefix: prefix.trim()
      }
    }, '*');
    
    setStatus({
      type: 'processing',
      message: 'Processing variables...'
    });
  };

  const canApply = selectedCollection && Object.values(platforms).some(Boolean);

  return (
    <div>
      <h2>Bulk Code Syntax</h2>
      
      <label>
        Variable Collection:
        <select 
          value={selectedCollection} 
          onChange={e => setSelectedCollection(e.target.value)}
        >
          {collections.length === 0 ? (
            <option value="">No collections found</option>
          ) : (
            collections.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))
          )}
        </select>
      </label>

      <fieldset>
        <legend>Platforms & Naming Conventions</legend>
        {(Object.keys(platforms) as Platform[]).map(platform => (
          <div key={platform} className="platform-option">
            <input
              type="checkbox"
              id={platform}
              checked={platforms[platform]}
              onChange={() => handlePlatformToggle(platform)}
            />
            <label htmlFor={platform} style={{ margin: 0, flex: 1 }}>
              {platform}
            </label>
            {platforms[platform] && (
              <select
                value={conventions[platform]}
                onChange={e => handleConventionChange(
                  platform, 
                  e.target.value as NamingConvention
                )}
              >
                <option value="camelCase">camelCase</option>
                <option value="snake_case">snake_case</option>
                <option value="kebab-case">kebab-case</option>
                <option value="PascalCase">PascalCase</option>
              </select>
            )}
          </div>
        ))}
      </fieldset>

      <label>
        Prefix (optional):
        <input
          type="text"
          value={prefix}
          onChange={e => setPrefix(e.target.value)}
          placeholder="e.g., ds"
        />
      </label>

      <button 
        onClick={handleApply}
        disabled={!canApply}
      >
        Apply Code Syntax
      </button>

      {status.type && (
        <div className={`status ${status.type}`}>
          {status.message}
        </div>
      )}
    </div>
  );
}

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
```

### 4. manifest.json

```json
{
  "name": "Bulk Code Syntax",
  "id": "bulk-code-syntax",
  "api": "1.0.0",
  "main": "code.js",
  "ui": "ui.html",
  "editorType": ["figma"],
  "documentAccess": "dynamic-page",
  "networkAccess": {
    "allowedDomains": []
  }
}
```

### 5. tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ES2020",
    "lib": ["ES2020"],
    "jsx": "react",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "moduleResolution": "node",
    "resolveJsonModule": true,
    "typeRoots": ["./node_modules/@types", "./node_modules/@figma"]
  },
  "include": ["*.ts", "*.tsx"],
  "exclude": ["node_modules"]
}
```

### 6. package.json

```json
{
  "name": "bulk-code-syntax",
  "version": "1.0.0",
  "description": "Bulk add code syntax to Figma variables",
  "scripts": {
    "build": "tsc --noEmit false",
    "watch": "tsc --watch --noEmit false"
  },
  "devDependencies": {
    "@figma/plugin-typings": "^1.97.0",
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "typescript": "^5.3.0"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  }
}
```

---

## Setup Steps

### Initial Plugin Creation

1. **Open Figma Desktop App**
2. Create a new design file (or open existing)
3. Go to **Plugins** → **Development** → **New Plugin**
4. In the modal:
   - Select **Figma design** (NOT FigJam)
   - Name: "Bulk Code Syntax"
   - Select **Custom UI** (YES, you need this for the React interface)
   - Click **Save as** and choose your `figma-plugins/bulk-code-syntax/` directory

This generates:
- `manifest.json`
- `code.ts` (boilerplate)
- `ui.html` (boilerplate)

### Development Setup

1. **Navigate to plugin directory:**
   ```bash
   cd figma-plugins/bulk-code-syntax
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Replace boilerplate files** with the implementations above

4. **Start TypeScript compilation:**
   ```bash
   npm run watch
   ```
   Or in VS Code: `Cmd+Shift+B` → select "tsc: watch - tsconfig.json"

5. **Run the plugin in Figma:**
   - Go to **Plugins** → **Development** → **Bulk Code Syntax**
   - Plugin UI will appear
   - Make changes to code, save, and the plugin will hot reload

---

## Testing Strategy

### Phase 1: Basic Functionality
1. Create a test variable collection with 5-10 variables
2. Use simple hierarchical names: `background/primary`, `text/secondary`
3. Run plugin with WEB + camelCase
4. Verify code syntax appears in Figma's variables panel

### Phase 2: Edge Cases
- Variables with numbers: `spacing/4`, `fontSize/16`
- Variables with special characters (if any)
- Single-level variables: `primary`
- Deep hierarchies: `component/button/background/primary/hover`

### Phase 3: Multiple Platforms
- Apply all three platforms simultaneously
- Verify each platform has correct naming convention
- Test prefix functionality

### Phase 4: Large Collections
- Test with 100+ variables
- Verify performance
- Ensure no timeouts

---

## Key Implementation Details

### Variable Path Construction
Figma variables use `/` as hierarchy separator:
- `background/primary/default` → splits into `['background', 'primary', 'default']`
- These parts get formatted according to naming convention
- Prefix gets prepended with convention-specific handling

### Code Syntax API
```typescript
variable.codeSyntax = {
  WEB: "backgroundPrimaryDefault",
  iOS: "backgroundColor.primary.default",
  ANDROID: "background_color_primary_default"
}
```

### Message Passing Pattern
```typescript
// UI → Plugin
parent.postMessage({ 
  pluginMessage: { type: 'action', data: {} } 
}, '*');

// Plugin → UI
figma.ui.postMessage({ 
  type: 'response', data: {} 
});
```

---

## Next Steps

1. **Create plugin in Figma Desktop** (generates structure)
2. **Set up monorepo** as outlined above
3. **Implement code from this plan**
4. **Test with small collection first**
5. **Iterate on UX/edge cases**
6. **Document usage** for other designers
7. **Consider publishing** to Figma Community

---

## Future Enhancements

- **Batch processing:** Process multiple collections at once
- **Preview mode:** Show what code syntax will be generated before applying
- **Custom templates:** Save favorite platform/convention combinations
- **Undo support:** Allow reverting code syntax changes
- **Export report:** Generate summary of applied changes

---

## Notes

**Yes, you need to select "Custom UI"** when creating the plugin. This gives you the iframe context where React runs. Without it, you'd have no UI at all (headless plugin).

The "Custom UI" option is what enables the dual-process architecture where your UI code runs separately from your plugin logic.
