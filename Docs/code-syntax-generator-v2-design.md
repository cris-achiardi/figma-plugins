# Code Syntax Generator v2.0 - Design Specification

## Overview

Complete redesign of the Code Syntax Generator plugin from a prefix-based system to a flexible template system with per-platform customization and live preview functionality.

### Design Goals

1. **Maximum Flexibility**: Support any code syntax pattern (CSS variables, SCSS, design tokens, etc.)
2. **Visual Feedback**: Live preview prevents formatting mistakes
3. **Performance**: Default to 20 variable preview for instant feedback
4. **Persistence**: Remember templates per collection + platform
5. **Clear Workflows**: Separate generate and remove operations

---

## User Interface Design

### Layout Structure

```
┌─────────────────────────────────────────────────────────────────┐
│ {🔧} Code Syntax Generator                                  [×] │
├─────────────────────────┬───────────────────────────────────────┤
│ LEFT PANEL              │ RIGHT PANEL                           │
│                         │                                       │
│ Variable Collection     │ Custom Template                       │
│ [collections ▼]         │                                       │
│                         │ [Web] [iOS] [Android] ← Tabs         │
│ Platforms & Naming      │                                       │
│ ☑ Web    [kebab-case▼]  │ Template:                            │
│ ☑ iOS    [camelCase ▼]  │ ┌────────────────┐                   │
│ ☐ Android [snake_case▼] │ │ vars(--ds-{token})│ [Apply Template]│
│                         │ └────────────────┘                   │
│ ☐ Remove code syntax    │                                       │
│    from selected        │ Preview (showing 20 of 145)  [Preview All]│
│    collection           │ ┌─────────────────────────────────┐  │
│                         │ │ vars(--ds-color-moonstone-100)  │  │
│ [Remove Code Syntax]    │ │ vars(--ds-color-moonstone-200)  │  │
│                         │ │ vars(--ds-color-moonstone-300)  │  │
│                         │ │ ...                             │  │
│                         │ └─────────────────────────────────┘  │
│                         │                                       │
│                         │ [Generate Code Syntax]                │
│                         │                                       │
└─────────────────────────┴───────────────────────────────────────┘
```

---

## Core Features

### 1. Template System

**Concept**: User defines a template with `{token}` placeholder
- Whatever comes before `{token}` = prefix
- Whatever comes after `{token}` = suffix

**Examples**:
- CSS Variables: `var(--{token})`
- With prefix: `var(--mantine-{token})`
- SCSS: `${token}`
- Design Tokens: `token.{token}`
- Custom: `whatever-{token}-suffix`

**Implementation**:
```typescript
// Template input component
<div className="template-input-wrapper">
  <input
    value={prefix}
    onChange={handlePrefixChange}
    placeholder="Prefix"
  />
  <span className="token-chip">{token}</span>
  <input
    value={suffix}
    onChange={handleSuffixChange}
    placeholder="Suffix"
  />
</div>

// Application logic
function applyTemplate(normalizedToken: string, prefix: string, suffix: string): string {
  return `${prefix}${normalizedToken}${suffix}`;
}
```

### 2. Per-Platform Configuration

**Each platform has independent:**
- Enable/disable checkbox
- Naming convention dropdown (camelCase, snake_case, kebab-case, PascalCase)
- Template (prefix + suffix)
- Preview tab

**State Management**:
```typescript
const [platforms, setPlatforms] = useState<Record<Platform, boolean>>({
  WEB: false,
  iOS: false,
  ANDROID: false
});

const [conventions, setConventions] = useState<Record<Platform, string>>({
  WEB: 'kebab-case',
  iOS: 'camelCase',
  ANDROID: 'snake_case'
});

const [templatePrefixes, setTemplatePrefixes] = useState<Record<Platform, string>>({
  WEB: '',
  iOS: '',
  ANDROID: ''
});

const [templateSuffixes, setTemplateSuffixes] = useState<Record<Platform, string>>({
  WEB: '',
  iOS: '',
  ANDROID: ''
});
```

### 3. Platform Tabs

**Tab States**:

| Platform State | Tab Appearance | Behavior |
|---------------|----------------|----------|
| Unchecked | Gray, non-clickable | Cannot be selected |
| Checked, not active | Blue, clickable | Click to switch to this platform |
| Checked, active | Blue, bold border | Currently displayed template/preview |

**Behavior**:
- When user checks a platform → Platform checkbox becomes enabled → Tab becomes clickable
- Clicking tab switches to that platform's template and preview
- Each platform remembers its own template independently

### 4. Preview System

**Default Behavior**: Show 20 variables (performance optimization)

**Preview States**:

#### Empty State (No preview generated)
```
Preview

Click "Apply Template" to generate preview
```

#### Loading State
```
Preview

⟳ Generating preview for 145 variables...
```

#### Partial Preview (Default)
```
Preview (showing 20 of 145 variables)          [Preview All]

var(--ds-color-moonstone-100)
var(--ds-color-moonstone-200)
...
var(--ds-color-red-9)
```

#### Full Preview
```
Preview (showing all 145 variables)            [Show Less]

var(--ds-color-moonstone-100)
var(--ds-color-moonstone-200)
...
(all 145 variables, scrollable)
```

#### Existing Code Syntax Display
```
Preview - Existing Code Syntax

var(--ds-color-moonstone-100)
var(--ds-color-moonstone-200)
...

ℹ️ Showing existing code syntax. Edit template and click
   "Apply Template" to preview changes.
```

**Preview Generation**:
- Triggered ONLY by "Apply Template" button click
- Not triggered by typing in template fields (prevents performance issues)
- Generates for currently active platform tab

### 5. Persistence (LocalStorage)

**Storage Key**: `code-syntax-generator-templates`

**Data Structure**:
```typescript
interface StoredTemplates {
  [collectionId: string]: {
    [platform: string]: {
      prefix: string;
      suffix: string;
      convention: string;
    };
  };
}

// Example
{
  "123:456": {
    "WEB": {
      "prefix": "var(--ds-",
      "suffix": ")",
      "convention": "kebab-case"
    },
    "iOS": {
      "prefix": "",
      "suffix": "",
      "convention": "camelCase"
    }
  }
}
```

**Save Triggers**:
- Template prefix/suffix changes
- Convention changes
- Platform enabled/disabled

**Load Triggers**:
- Collection selected
- Plugin opened

### 6. Loading Existing Code Syntax

**Simplified Approach** (v1.0):
- Read existing code syntax from Figma variables
- Display in preview panel (read-only)
- Don't auto-populate template fields
- User manually fills template

**Future Enhancement** (v1.1):
- Parse existing syntax to detect prefix/suffix
- Auto-populate template fields
- Handle cases where convention doesn't match

**Implementation**:
```typescript
// code.ts
if (msg.type === 'load-collection') {
  const collection = await figma.variables.getVariableCollectionByIdAsync(collectionId);
  const variables = await getVariables(collection);

  // Read existing code syntax
  const existingSyntax: Record<Platform, string[]> = {
    WEB: [],
    iOS: [],
    ANDROID: []
  };

  variables.forEach(v => {
    if (v.codeSyntax.WEB) existingSyntax.WEB.push(v.codeSyntax.WEB);
    if (v.codeSyntax.iOS) existingSyntax.iOS.push(v.codeSyntax.iOS);
    if (v.codeSyntax.ANDROID) existingSyntax.ANDROID.push(v.codeSyntax.ANDROID);
  });

  figma.ui.postMessage({
    type: 'existing-syntax-found',
    existingSyntax,
    hasExisting: {
      WEB: existingSyntax.WEB.length > 0,
      iOS: existingSyntax.iOS.length > 0,
      ANDROID: existingSyntax.ANDROID.length > 0
    }
  });
}
```

---

## User Workflows

### Workflow 1: Generate Code Syntax (New Collection)

```
1. Select collection
   ↓
2. Check "Web" platform
   ↓
3. Select "kebab-case" convention
   → Web tab becomes active
   → Template shows default: "" + {token} + ""
   ↓
4. Type template: "var(--ds-" (prefix) and ")" (suffix)
   ↓
5. Click "Apply Template"
   → Preview generates for first 20 variables
   → Shows: "Showing 20 of 145 variables"
   ↓
6. (Optional) Click "Preview All"
   → Generates all 145 variables
   → Shows: "Showing all 145 variables"
   ↓
7. Click "Generate Code Syntax"
   → Writes to Figma variables
   → Success: "Code syntax applied to 145 variables (Web)"
```

### Workflow 2: Multi-Platform Generation

```
1. Select collection
   ↓
2. Configure Web:
   ☑ Web [kebab-case] → Template: var(--{token})
   ↓
3. Configure iOS:
   ☑ iOS [camelCase] → Template: {token}
   (no wrapper for iOS)
   ↓
4. Switch between tabs to verify:
   [Web] tab → Preview: var(--color-moonstone-100)
   [iOS] tab → Preview: colorMoonstone100
   ↓
5. Click "Generate Code Syntax"
   → Applies to both Web and iOS platforms
   → Each uses their own convention + template
```

### Workflow 3: Update Existing Code Syntax

```
1. Select collection with existing syntax
   ↓
2. Plugin loads existing code syntax
   → Preview shows: "Preview - Existing Code Syntax"
   → Displays current values
   ↓
3. User fills template fields to match existing pattern
   ↓
4. Click "Apply Template"
   → Preview updates with new template
   ↓
5. Verify changes in preview
   ↓
6. Click "Generate Code Syntax"
   → Updates all variables with new syntax
```

### Workflow 4: Remove Code Syntax

```
1. Select collection
   ↓
2. Check platforms to clear: ☑ Web ☑ iOS
   ↓
3. Check "Remove code syntax from selected collection"
   → Template/preview section grays out
   → "Generate Code Syntax" button becomes disabled
   ↓
4. Click "Remove Code Syntax"
   → Executes removal immediately
   → Success: "Code syntax removed from 145 variables (Web, iOS)"
```

---

## Technical Implementation

### Message Protocol (code.ts ↔ ui.tsx)

#### UI → Plugin Messages

```typescript
type UIMessage =
  // Load collection and check for existing syntax
  | {
      type: 'load-collection';
      collectionId: string;
    }

  // Generate preview for specific platform
  | {
      type: 'generate-preview';
      collectionId: string;
      platform: Platform;
      convention: string;
      prefix: string;
      suffix: string;
      limit?: number; // Default 20
    }

  // Apply code syntax to Figma variables
  | {
      type: 'apply-code-syntax';
      collectionId: string;
      platforms: Platform[];
      conventions: Record<Platform, string>;
      prefixes: Record<Platform, string>;
      suffixes: Record<Platform, string>;
    }

  // Remove code syntax from platforms
  | {
      type: 'remove-code-syntax';
      collectionId: string;
      platforms: Platform[];
    };
```

#### Plugin → UI Messages

```typescript
type PluginMessage =
  // List of available collections
  | {
      type: 'collections-list';
      collections: Collection[];
    }

  // Existing code syntax found in collection
  | {
      type: 'existing-syntax-found';
      existingSyntax: Record<Platform, string[]>;
      hasExisting: Record<Platform, boolean>;
    }

  // Preview generation result
  | {
      type: 'preview-result';
      platform: Platform;
      previews: Array<{
        original: string; // Variable name
        generated: string; // Generated code syntax
      }>;
      total: number;
      showing: number;
    }

  // Code syntax applied successfully
  | {
      type: 'apply-complete';
      count: number;
      platforms: Platform[];
    }

  // Code syntax removed successfully
  | {
      type: 'remove-complete';
      count: number;
      platforms: Platform[];
    }

  // Error occurred
  | {
      type: 'error';
      message: string;
    };
```

### Core Functions (code.ts)

#### applyTemplate()
```typescript
function applyTemplate(
  normalizedToken: string,
  prefix: string,
  suffix: string
): string {
  return `${prefix}${normalizedToken}${suffix}`;
}
```

#### formatPath() - Updated
```typescript
function formatPath(
  parts: string[], // ["colors", "red", "5"]
  convention: string, // "kebab-case"
  prefix: string, // "var(--ds-"
  suffix: string // ")"
): string {
  // Normalize each segment according to convention
  const normalizedSegments = parts.map((segment, index) =>
    normalizeSegment(segment, convention, index === 0)
  );

  // Join segments with appropriate separator
  const separator = getSeparatorForConvention(convention);
  const normalizedToken = normalizedSegments.join(separator);

  // Apply template
  return applyTemplate(normalizedToken, prefix, suffix);
}
```

#### generatePreview() - New
```typescript
async function generatePreview(
  collectionId: string,
  platform: Platform,
  convention: string,
  prefix: string,
  suffix: string,
  limit: number = 20
): Promise<PreviewItem[]> {
  const collection = await figma.variables.getVariableCollectionByIdAsync(collectionId);
  const variables = await Promise.all(
    collection.variableIds.map(id => figma.variables.getVariableByIdAsync(id))
  );

  const validVariables = variables.filter(v => v !== null);
  const previewLimit = Math.min(limit, validVariables.length);

  return validVariables.slice(0, previewLimit).map(variable => ({
    original: variable.name,
    generated: formatPath(
      variable.name.split('/'),
      convention,
      prefix,
      suffix
    )
  }));
}
```

---

## Implementation Phases

### Phase 1: Backend Logic (code.ts)

**Tasks**:
- [ ] Remove prefix/normalizePrefix parameters from all functions
- [ ] Update `formatPath()` to accept prefix + suffix parameters
- [ ] Create `applyTemplate()` function
- [ ] Create `generatePreview()` function
- [ ] Add `load-collection` message handler
- [ ] Add `generate-preview` message handler (with limit parameter)
- [ ] Update `apply-code-syntax` handler to use prefix/suffix
- [ ] Add `remove-code-syntax` message handler

**Key Changes**:
```typescript
// OLD
function formatPath(
  parts: string[],
  convention: string,
  prefix: string,
  normalizePrefix: boolean
): string { ... }

// NEW
function formatPath(
  parts: string[],
  convention: string,
  prefix: string,
  suffix: string
): string { ... }
```

### Phase 2: UI Components (ui.tsx)

**Tasks**:
- [ ] Update state management:
  - Remove `prefix` and `normalizePrefix` states
  - Add `templatePrefixes` and `templateSuffixes` per platform
  - Add `previews` per platform
  - Add `previewExpanded` per platform
  - Add `activeTab` state
- [ ] Build template input component (2 inputs + {token} chip)
- [ ] Implement platform tabs:
  - Active/inactive/disabled states
  - Click handlers to switch tabs
  - Visual styling (blue, gray, bold border)
- [ ] Create preview panel:
  - Empty state component
  - Loading state component
  - Preview list component (virtualized scroll for performance)
  - "Preview All" / "Show Less" toggle
  - Existing syntax display
- [ ] Add "Apply Template" button + handler
- [ ] Update "Generate Code Syntax" button logic
- [ ] Update platform checkboxes to enable/disable tabs
- [ ] Add remove mode checkbox + button

**Component Structure**:
```tsx
<App>
  <LeftPanel>
    <CollectionDropdown />
    <PlatformsList>
      {platforms.map(platform => (
        <PlatformRow
          key={platform}
          platform={platform}
          enabled={platforms[platform]}
          convention={conventions[platform]}
          onEnabledChange={...}
          onConventionChange={...}
        />
      ))}
    </PlatformsList>
    <RemoveSection>
      <Checkbox checked={removeMode} onChange={...} />
      <Button onClick={handleRemove}>Remove Code Syntax</Button>
    </RemoveSection>
  </LeftPanel>

  <RightPanel>
    <PlatformTabs
      platforms={platforms}
      activeTab={activeTab}
      onTabChange={setActiveTab}
    />

    <TemplateInput
      prefix={templatePrefixes[activeTab]}
      suffix={templateSuffixes[activeTab]}
      onPrefixChange={...}
      onSuffixChange={...}
      disabled={removeMode}
    />

    <Button onClick={handleApplyTemplate}>Apply Template</Button>

    <PreviewPanel
      platform={activeTab}
      preview={previews[activeTab]}
      expanded={previewExpanded[activeTab]}
      onToggleExpand={...}
    />

    <Button onClick={handleGenerate}>Generate Code Syntax</Button>
  </RightPanel>
</App>
```

### Phase 3: Persistence

**Tasks**:
- [ ] Implement LocalStorage save/load utilities
- [ ] Key structure: `code-syntax-generator-templates`
- [ ] Save on every template/convention change
- [ ] Load on collection selection
- [ ] Handle missing/corrupted localStorage gracefully

**Implementation**:
```typescript
// Save to localStorage
function saveTemplates(
  collectionId: string,
  platform: Platform,
  prefix: string,
  suffix: string,
  convention: string
) {
  const key = 'code-syntax-generator-templates';
  const stored = JSON.parse(localStorage.getItem(key) || '{}');

  if (!stored[collectionId]) {
    stored[collectionId] = {};
  }

  stored[collectionId][platform] = { prefix, suffix, convention };

  localStorage.setItem(key, JSON.stringify(stored));
}

// Load from localStorage
function loadTemplates(collectionId: string): StoredTemplates | null {
  const key = 'code-syntax-generator-templates';
  const stored = JSON.parse(localStorage.getItem(key) || '{}');
  return stored[collectionId] || null;
}
```

### Phase 4: Polish & Documentation

**Tasks**:
- [ ] Add naming convention dropdown default: "Select convention..."
- [ ] Add stale preview indicator (when convention changes after preview generated)
- [ ] Performance optimization:
  - Virtual scrolling for large preview lists
  - Debounced template input (if real-time preview added later)
- [ ] Error handling and user feedback:
  - Show errors clearly
  - Success messages
  - Loading states
- [ ] Update version to 2.0.0 in package.json
- [ ] Update README with new workflow examples
- [ ] Update plugin description in manifest.json
- [ ] Add inline help text/tooltips
- [ ] Test with various collection sizes (10, 100, 500+ variables)

---

## Migration from v1.x to v2.0

### Breaking Changes

**Removed Features**:
- ✗ Prefix input field (replaced by template prefix)
- ✗ Normalize prefix checkbox (no longer needed)
- ✗ Automatic preview on change (now manual with button)

**New Features**:
- ✓ Template system with full control over prefix + suffix
- ✓ Per-platform templates
- ✓ Manual preview generation (performance)
- ✓ Preview All option
- ✓ Load existing code syntax
- ✓ Template persistence (LocalStorage)

### User Impact

**Users upgrading from v1.x**:
- Previous prefix configurations won't be migrated
- Users need to recreate templates using new system
- More flexible but requires understanding template concept

**Recommendation**:
- Update README with clear migration guide
- Show template examples in plugin UI
- Consider adding template presets in future version

---

## Future Enhancements (v2.1+)

### Smart Parsing of Existing Syntax
- Auto-detect prefix/suffix from existing code syntax
- Pre-populate template fields
- Handle convention mismatches gracefully

### Template Library
- Save/load custom templates across collections
- Share templates with team
- Built-in presets: CSS Variables, SCSS, Design Tokens, etc.

### Find & Replace
- Search existing code syntax
- Bulk replace patterns
- Regex support

### Batch Operations
- Process multiple collections at once
- Export/import templates
- Sync across Figma files

### Advanced Preview
- Show diff (before/after)
- Filter preview by variable type
- Search within preview

### Performance Improvements
- Virtual scrolling for huge collections (1000+ variables)
- Background processing for preview generation
- Progressive preview (show first 20, then load rest)

---

## Testing Scenarios

### Test Case 1: Basic Template Generation
1. Select collection (50 variables)
2. Enable Web platform, select kebab-case
3. Set template: `var(--{token})`
4. Generate preview (20 variables)
5. Verify preview shows correct format
6. Generate code syntax
7. Verify all 50 variables have correct syntax in Figma

### Test Case 2: Multi-Platform
1. Select collection
2. Enable Web (kebab-case) + iOS (camelCase)
3. Set different templates:
   - Web: `var(--{token})`
   - iOS: `{token}` (no wrapper)
4. Switch between tabs, verify each preview
5. Generate code syntax
6. Verify each platform has correct syntax

### Test Case 3: Large Collection Performance
1. Select collection (500+ variables)
2. Set template
3. Generate preview (should show 20 quickly)
4. Click "Preview All"
5. Verify all 500 load (may take 2-3 seconds)
6. Generate code syntax
7. Verify all 500 updated correctly

### Test Case 4: Persistence
1. Configure template for collection A
2. Switch to collection B
3. Configure different template
4. Switch back to collection A
5. Verify template is restored from localStorage

### Test Case 5: Existing Syntax
1. Select collection with existing code syntax
2. Verify existing syntax displays in preview
3. Set new template
4. Generate preview
5. Verify shows new format
6. Generate code syntax
7. Verify overrides old syntax

### Test Case 6: Remove Code Syntax
1. Select collection with code syntax
2. Check platforms to remove
3. Enable remove mode checkbox
4. Click "Remove Code Syntax"
5. Verify code syntax cleared for selected platforms
6. Verify other platforms unaffected

---

## Performance Benchmarks

### Target Performance
- Collection load: < 500ms
- Preview generation (20 vars): < 100ms
- Preview generation (500 vars): < 3s
- Code syntax application (500 vars): < 5s

### Optimization Strategies
- Async/await for Figma API calls
- Batch variable processing
- Virtual scrolling for preview list
- Debounced preview updates (if real-time added)
- Web worker for large computations (future)

---

## Accessibility Considerations

- Keyboard navigation for tabs
- ARIA labels for all interactive elements
- Focus management (trap focus in modal when open)
- Clear error messages
- Sufficient color contrast
- Loading indicators for long operations

---

## Version History

### v2.0.0 (Planned)
- Complete redesign: prefix → template system
- Per-platform templates
- Manual preview generation
- Template persistence
- Load existing code syntax

### v1.0.2 (Current)
- Prefix-based system
- Multi-platform support
- Naming conventions
- Prefix normalization
- Dark mode support

---

## Contact & Feedback

**Plugin Link**: https://www.figma.com/community/plugin/1580938580932953714

**Feedback**: Users should report issues and feature requests through Figma Community comments or plugin support link.

---

*Document Version: 1.0*
*Last Updated: 2024-12-16*
*Author: Cristian Morales*
