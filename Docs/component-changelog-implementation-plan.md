# Component Changelog Plugin — Implementation Plan

## Context

Build a Figma plugin that extracts component data, stores versioned snapshots in Supabase with a manual approval pipeline, and can generate JSON to rebuild components. Version bumping follows development best practices: triggered manually after reviews and approvals — not automated.

**Approval flow**: Draft → Review (diff) → Approve → Pick Semver → Write Message → Publish Version
**Demo mode**: Same user can approve their own changes (enforceable later via RLS).

---

## Phase 1: Plugin Scaffold + Supabase Schema

### 1.1 Create plugin folder structure

```
plugins/component-changelog/
├── manifest.json
├── package.json
├── tsconfig.json
├── types.ts
├── code.ts
├── ui.tsx
├── supabase.ts
├── inline-ui.js
```

### 1.2 manifest.json
```json
{
  "name": "Component Changelog",
  "id": "PLACEHOLDER_ID",
  "api": "1.0.0",
  "main": "code.js",
  "ui": "ui.html",
  "editorType": ["figma"],
  "documentAccess": "dynamic-page",
  "networkAccess": {
    "allowedDomains": ["https://*.supabase.co", "https://*.supabase.in"]
  }
}
```

### 1.3 package.json
Follow existing pattern. Add dependencies:
- `@supabase/supabase-js` — Supabase client
- `deep-diff` — JSON diffing
- `react`, `react-dom` — UI
- `@figma-plugins/shared-ui` — shared components
- `@figma/plugin-typings`, `esbuild`, `typescript` — dev

### 1.4 tsconfig.json
Copy from ds-adoption-tracker. Add `supabase.ts` to files list.

### 1.5 inline-ui.js
Copy from ds-adoption-tracker (identical pattern).

### 1.6 Root package.json
Add workspace entry if needed (already covered by `plugins/*` glob).

### 1.7 Supabase schema

```sql
-- Projects table
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  figma_file_key TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Component versions with approval workflow
CREATE TABLE component_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id),
  component_key TEXT NOT NULL,
  component_name TEXT NOT NULL,
  version TEXT NOT NULL,                -- semver: "1.2.0"
  status TEXT NOT NULL DEFAULT 'draft', -- draft | in_review | approved | published
  snapshot JSONB NOT NULL,              -- JSON_REST_V1 export
  property_definitions JSONB,
  variables_used JSONB,
  thumbnail_url TEXT,
  diff JSONB,                           -- diff against previous published version
  changelog_message TEXT,               -- human-written changelog entry
  bump_type TEXT,                       -- patch | minor | major
  created_by TEXT,
  reviewed_by TEXT,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(project_id, component_key, version)
);

-- Audit log
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  component_version_id UUID REFERENCES component_versions(id),
  action TEXT NOT NULL,                 -- created | submitted_for_review | approved | published | rejected
  performed_by TEXT,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS policies (demo: allow all authenticated, production: enforce reviewer != creator)
ALTER TABLE component_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
```

**Files to create/modify:**
- `plugins/component-changelog/manifest.json` — new
- `plugins/component-changelog/package.json` — new
- `plugins/component-changelog/tsconfig.json` — new
- `plugins/component-changelog/inline-ui.js` — copy from ds-adoption-tracker
- Supabase project setup (manual, via Supabase dashboard)

---

## Phase 2: Types + Supabase Client

### 2.1 types.ts — Shared types

```ts
// Version status workflow
export type VersionStatus = 'draft' | 'in_review' | 'approved' | 'published';
export type BumpType = 'patch' | 'minor' | 'major';
export type AuditAction = 'created' | 'submitted_for_review' | 'approved' | 'published' | 'rejected';

// Data models
export interface ComponentVersion {
  id: string;
  project_id: string;
  component_key: string;
  component_name: string;
  version: string;
  status: VersionStatus;
  snapshot: any;              // JSON_REST_V1 structure
  property_definitions: any;
  variables_used: any;
  thumbnail_url: string | null;
  diff: any | null;
  changelog_message: string | null;
  bump_type: BumpType | null;
  created_by: string;
  reviewed_by: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuditEntry {
  id: string;
  component_version_id: string;
  action: AuditAction;
  performed_by: string;
  note: string | null;
  created_at: string;
}

// Extracted component data (from sandbox)
export interface ExtractedComponent {
  key: string;
  name: string;
  nodeId: string;
  snapshot: any;
  propertyDefinitions: any;
  variablesUsed: any;
  thumbnailBytes: number[];   // PNG bytes
  publishStatus: string;
}

// Messages: UI → Code
export type UIMessage =
  | { type: 'extract-components'; scope: 'page' | 'selection' }
  | { type: 'extract-single'; nodeId: string }
  | { type: 'navigate'; nodeId: string }
  | { type: 'reconstruct'; snapshot: any };

// Messages: Code → UI
export type CodeMessage =
  | { type: 'init'; userName: string; fileKey: string }
  | { type: 'extraction-complete'; components: ExtractedComponent[] }
  | { type: 'extraction-progress'; message: string; percent: number }
  | { type: 'reconstruction-complete'; nodeId: string }
  | { type: 'error'; message: string };
```

### 2.2 supabase.ts — Client setup (runs in UI context)

```ts
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://YOUR_PROJECT.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// API functions for the approval workflow
export async function createDraft(data: {...}): Promise<ComponentVersion> { ... }
export async function submitForReview(versionId: string, userId: string): Promise<void> { ... }
export async function approveVersion(versionId: string, reviewerId: string): Promise<void> { ... }
export async function publishVersion(versionId: string, bumpType: BumpType, message: string): Promise<void> { ... }
export async function getVersionHistory(componentKey: string, projectId: string): Promise<ComponentVersion[]> { ... }
export async function getLatestPublished(componentKey: string, projectId: string): Promise<ComponentVersion | null> { ... }
export async function uploadThumbnail(bytes: Uint8Array, path: string): Promise<string> { ... }
export async function logAudit(versionId: string, action: AuditAction, userId: string, note?: string): Promise<void> { ... }
```

**Files to create:**
- `plugins/component-changelog/types.ts`
- `plugins/component-changelog/supabase.ts`

---

## Phase 3: Sandbox Logic (code.ts)

### 3.1 Plugin initialization
- `figma.showUI(__html__, { width: 480, height: 640 })`
- `figma.skipInvisibleInstanceChildren = true`
- Send init message with `figma.currentUser.name` and file key

### 3.2 Component extraction
- `findAllWithCriteria({ types: ['COMPONENT', 'COMPONENT_SET'] })` for discovery
- For each component:
  - `exportAsync({ format: 'JSON_REST_V1' })` → full snapshot
  - `exportAsync({ format: 'PNG', constraint: { type: 'SCALE', value: 2 } })` → thumbnail
  - Read `componentPropertyDefinitions`
  - Read `boundVariables` recursively on children
  - Read `key` (PublishableMixin) for stable identifier
  - Read `getPublishStatusAsync()` for library status
- Send progress updates during extraction
- Send extracted data to UI via `figma.ui.postMessage()`

### 3.3 Reconstruction (Phase 4 feature, stub for now)
- Receive JSON snapshot from UI
- Walk tree recursively, create nodes per type
- Apply properties, fills, strokes, effects, layout
- Return created node ID

### 3.4 Navigation
- `figma.viewport.scrollAndZoomIntoView([node])` for navigating to components

**Files to create:**
- `plugins/component-changelog/code.ts`

---

## Phase 4: React UI (ui.tsx)

### 4.1 Views/Screens

**Screen 1: Component List** (default)
- Shows all components on current page/selection
- Each component shows: name, publish status, last version, status badge
- "Create Draft" button per component → extracts and sends to Supabase
- "Extract All" button for bulk extraction

**Screen 2: Version Detail / Approval Pipeline**
- Shows draft snapshot with JSON diff against last published version
- Status badge: `draft` → `in_review` → `approved` → `published`
- Action buttons based on current status:
  - Draft: "Submit for Review" button
  - In Review: "Approve" button + "Reject" button
  - Approved: Semver picker (patch/minor/major) + changelog message input + "Publish" button
  - Published: Read-only view with changelog
- Diff viewer: highlights added/removed/changed properties
- Thumbnail preview (before/after)

**Screen 3: Version History**
- Timeline of all published versions for a component
- Each entry shows: version number, bump type badge, changelog message, date, author
- Click to expand and see full diff
- "Restore" button (future: triggers reconstruction)

### 4.2 Wireframes

Plugin window: **480 x 640px**

#### Screen 1: Component List (Default View)

```
┌──────────────────────────────────────────────────┐
│  Component Changelog                        v0.1 │
├──────────────────────────────────────────────────┤
│                                                  │
│  Scope: [ Page v ]              [ Extract All ]  │
│                                                  │
│  ┌─────────────────────────────────────────────┐ │
│  │  Search components...                       │ │
│  └─────────────────────────────────────────────┘ │
│                                                  │
│  Found 4 components                              │
│                                                  │
│  ┌─────────────────────────────────────────────┐ │
│  │  Button                                     │ │
│  │  ┌──────────┐  Published v1.2.0             │ │
│  │  │          │  Status: * UP_TO_DATE         │ │
│  │  │ (thumb)  │  3 variants  5 properties     │ │
│  │  │          │  Last: Feb 4, 2026            │ │
│  │  └──────────┘                               │ │
│  │              [ Create Draft ]  [ History ]  │ │
│  └─────────────────────────────────────────────┘ │
│                                                  │
│  ┌─────────────────────────────────────────────┐ │
│  │  Input                                      │ │
│  │  ┌──────────┐  Draft v1.1.0                 │ │
│  │  │          │  Status: * CHANGED            │ │
│  │  │ (thumb)  │  2 variants  3 properties     │ │
│  │  │          │  Draft by: Carlos             │ │
│  │  └──────────┘                               │ │
│  │              [ View Draft ]    [ History ]   │ │
│  └─────────────────────────────────────────────┘ │
│                                                  │
│  ┌─────────────────────────────────────────────┐ │
│  │  Card                                       │ │
│  │  ┌──────────┐  No versions yet              │ │
│  │  │          │  Status: * UNPUBLISHED        │ │
│  │  │ (thumb)  │  1 variant  2 properties      │ │
│  │  │          │                               │ │
│  │  └──────────┘                               │ │
│  │              [ Create Draft ]               │ │
│  └─────────────────────────────────────────────┘ │
│                                                  │
│  ┌─────────────────────────────────────────────┐ │
│  │  Avatar                                     │ │
│  │  ┌──────────┐  Published v2.0.0             │ │
│  │  │ (thumb)  │  Status: * UP_TO_DATE         │ │
│  │  └──────────┘                               │ │
│  │              [ Create Draft ]  [ History ]  │ │
│  └─────────────────────────────────────────────┘ │
│                                                  │
└──────────────────────────────────────────────────┘
```

**Interaction notes:**
- **Scope dropdown**: `Page` | `Selection` (like ds-adoption-tracker)
- **Extract All**: Extracts all components, creates drafts in bulk
- **Create Draft**: Extracts single component, sends snapshot to Supabase as `draft`
- **View Draft**: Goes to Screen 2 (approval pipeline) for existing draft
- **History**: Goes to Screen 3 (version timeline)
- Status dot color: green = UP_TO_DATE, yellow = CHANGED, gray = UNPUBLISHED

#### Screen 2: Version Detail / Approval Pipeline

Four states based on `status`. Only one visible at a time.

**State A: Draft (just created)**

```
┌──────────────────────────────────────────────────┐
│  < Back                          Button  v1.3.0  │
├──────────────────────────────────────────────────┤
│                                                  │
│  Status: o Draft  .  .  .                        │
│          ======= ----- ----- -----               │
│          draft  review approved published        │
│                                                  │
│  Created by: Carlos  Feb 6, 2026                 │
│                                                  │
│  ┌─ Thumbnail ──────────────────────────────────┐│
│  │   ┌──────────┐     ┌──────────┐             ││
│  │   │ Previous │     │ Current  │             ││
│  │   │  v1.2.0  │ --> │  Draft   │             ││
│  │   │          │     │          │             ││
│  │   └──────────┘     └──────────┘             ││
│  └──────────────────────────────────────────────┘│
│                                                  │
│  ┌─ Changes vs v1.2.0 ─────────────────────────┐│
│  │                                              ││
│  │  + Added variant: Size=XLarge               ││
│  │  ~ Changed fills[0].color                   ││
│  │    from: rgba(59, 130, 246, 1)              ││
│  │    to:   rgba(37, 99, 235, 1)               ││
│  │  ~ Changed paddingLeft: 16 -> 20            ││
│  │  ~ Changed paddingRight: 16 -> 20           ││
│  │  - Removed effect: DROP_SHADOW              ││
│  │                                              ││
│  └──────────────────────────────────────────────┘│
│                                                  │
│  ┌──────────────────────────────────────────────┐│
│  │              [ Submit for Review ]           ││
│  └──────────────────────────────────────────────┘│
│                                                  │
└──────────────────────────────────────────────────┘
```

**State B: In Review**

```
┌──────────────────────────────────────────────────┐
│  < Back                          Button  v1.3.0  │
├──────────────────────────────────────────────────┤
│                                                  │
│  Status: v Draft -> o In Review  .  .            │
│          ======================= ----- -----     │
│          draft     review      approved published│
│                                                  │
│  Created by: Carlos  Submitted: Feb 6, 2026     │
│                                                  │
│  ┌─ Thumbnail ──────────────────────────────────┐│
│  │   ┌──────────┐     ┌──────────┐             ││
│  │   │ Previous │ --> │ Current  │             ││
│  │   │  v1.2.0  │     │  Draft   │             ││
│  │   └──────────┘     └──────────┘             ││
│  └──────────────────────────────────────────────┘│
│                                                  │
│  ┌─ Changes vs v1.2.0 ─────────────────────────┐│
│  │  + Added variant: Size=XLarge               ││
│  │  ~ Changed fills[0].color                   ││
│  │    from: rgba(59, 130, 246, 1)              ││
│  │    to:   rgba(37, 99, 235, 1)               ││
│  │  ~ Changed paddingLeft: 16 -> 20            ││
│  │  ~ Changed paddingRight: 16 -> 20           ││
│  │  - Removed effect: DROP_SHADOW              ││
│  └──────────────────────────────────────────────┘│
│                                                  │
│  ┌──────────────────────────────────────────────┐│
│  │  Review note (optional):                    ││
│  │  ┌──────────────────────────────────────┐   ││
│  │  │ Looks good, new XL variant matches   │   ││
│  │  │ the updated spacing guidelines.      │   ││
│  │  └──────────────────────────────────────┘   ││
│  │                                              ││
│  │       [ Reject ]          [ Approve ]       ││
│  └──────────────────────────────────────────────┘│
│                                                  │
└──────────────────────────────────────────────────┘
```

**State C: Approved (ready to publish)**

```
┌──────────────────────────────────────────────────┐
│  < Back                          Button  v1.3.0  │
├──────────────────────────────────────────────────┤
│                                                  │
│  Status: v Draft -> v Reviewed -> o Approved  .  │
│          =================================== --- │
│          draft     review       approved published│
│                                                  │
│  Approved by: Carlos  Feb 6, 2026               │
│                                                  │
│  ┌─ Changes vs v1.2.0 ─────────────────────────┐│
│  │  + Added variant: Size=XLarge               ││
│  │  ~ Changed fills[0].color                   ││
│  │  ~ Changed paddingLeft: 16 -> 20            ││
│  │  ~ Changed paddingRight: 16 -> 20           ││
│  │  - Removed effect: DROP_SHADOW              ││
│  └──────────────────────────────────────────────┘│
│                                                  │
│  ┌─ Publish ────────────────────────────────────┐│
│  │                                              ││
│  │  Version bump:                              ││
│  │  ┌────────┐ ┌────────┐ ┌────────┐          ││
│  │  │ Patch  │ │* Minor │ │ Major  │          ││
│  │  │ 1.2.1  │ │ 1.3.0  │ │ 2.0.0  │          ││
│  │  └────────┘ └────────┘ └────────┘          ││
│  │                                              ││
│  │  Changelog message:                         ││
│  │  ┌──────────────────────────────────────┐   ││
│  │  │ Added XLarge size variant. Updated   │   ││
│  │  │ primary color to match new brand     │   ││
│  │  │ guidelines. Increased horizontal     │   ││
│  │  │ padding for better touch targets.    │   ││
│  │  │ Removed default shadow.              │   ││
│  │  └──────────────────────────────────────┘   ││
│  │                                              ││
│  │              [ Publish v1.3.0 ]             ││
│  └──────────────────────────────────────────────┘│
│                                                  │
└──────────────────────────────────────────────────┘
```

**State D: Published (read-only)**

```
┌──────────────────────────────────────────────────┐
│  < Back                          Button  v1.3.0  │
├──────────────────────────────────────────────────┤
│                                                  │
│  Status: v Draft -> v Reviewed -> v Approved -> v│
│          ======================================= │
│          draft     review       approved published│
│                                                  │
│  ┌──────────────────────────────────────────────┐│
│  │  (v) Published                              ││
│  │  v1.3.0 (minor)  Feb 6, 2026               ││
│  │  By: Carlos                                 ││
│  └──────────────────────────────────────────────┘│
│                                                  │
│  ┌─ Changelog ──────────────────────────────────┐│
│  │                                              ││
│  │  Added XLarge size variant. Updated primary  ││
│  │  color to match new brand guidelines.        ││
│  │  Increased horizontal padding for better     ││
│  │  touch targets. Removed default shadow.      ││
│  │                                              ││
│  └──────────────────────────────────────────────┘│
│                                                  │
│  ┌─ Changes ────────────────────────────────────┐│
│  │  + Added variant: Size=XLarge               ││
│  │  ~ Changed fills[0].color                   ││
│  │  ~ Changed paddingLeft: 16 -> 20            ││
│  │  ~ Changed paddingRight: 16 -> 20           ││
│  │  - Removed effect: DROP_SHADOW              ││
│  └──────────────────────────────────────────────┘│
│                                                  │
│  ┌─ Audit Trail ────────────────────────────────┐│
│  │  14:32  Carlos  Created draft               ││
│  │  14:35  Carlos  Submitted for review        ││
│  │  14:40  Carlos  Approved                    ││
│  │  14:42  Carlos  Published as v1.3.0         ││
│  └──────────────────────────────────────────────┘│
│                                                  │
│       [ View History ]    [ Export JSON ]        │
│                                                  │
└──────────────────────────────────────────────────┘
```

#### Screen 3: Version History

```
┌──────────────────────────────────────────────────┐
│  < Back                       Button  History    │
├──────────────────────────────────────────────────┤
│                                                  │
│  Published versions                              │
│                                                  │
│  ┌──────────────────────────────────────────────┐│
│  │  v1.3.0  ┌───────┐  Feb 6, 2026            ││
│  │  MINOR   │ thumb │  Carlos                  ││
│  │          └───────┘                           ││
│  │  Added XLarge size variant. Updated primary  ││
│  │  color to match new brand guidelines.        ││
│  │                                              ││
│  │  [ View Details ]  [ Export JSON ]           ││
│  ├──────────────────────────────────────────────┤│
│  │  v1.2.0  ┌───────┐  Jan 28, 2026           ││
│  │  MINOR   │ thumb │  Maria                   ││
│  │          └───────┘                           ││
│  │  Added Ghost variant style. Updated          ││
│  │  documentation links.                        ││
│  │                                              ││
│  │  [ View Details ]  [ Export JSON ]           ││
│  ├──────────────────────────────────────────────┤│
│  │  v1.1.0  ┌───────┐  Jan 15, 2026           ││
│  │  MINOR   │ thumb │  Carlos                  ││
│  │          └───────┘                           ││
│  │  Added Secondary variant. Added Disabled     ││
│  │  boolean property.                           ││
│  │                                              ││
│  │  [ View Details ]  [ Export JSON ]           ││
│  ├──────────────────────────────────────────────┤│
│  │  v1.0.0  ┌───────┐  Jan 5, 2026            ││
│  │  MAJOR   │ thumb │  Carlos                  ││
│  │          └───────┘                           ││
│  │  Initial version. Primary button with        ││
│  │  Small, Medium, Large size variants.         ││
│  │                                              ││
│  │  [ View Details ]  [ Export JSON ]           ││
│  └──────────────────────────────────────────────┘│
│                                                  │
│  ┌──────────────────────────────────────────────┐│
│  │  Pending: 1 draft in progress               ││
│  │  v1.4.0 (draft) by Carlos                   ││
│  │                    [ View Draft ]            ││
│  └──────────────────────────────────────────────┘│
│                                                  │
└──────────────────────────────────────────────────┘
```

**Expanded entry (click "View Details"):**

```
│  ┌──────────────────────────────────────────────┐│
│  │  v1.2.0  ┌───────┐  Jan 28, 2026           ││
│  │  MINOR   │ thumb │  Maria                   ││
│  │          └───────┘                           ││
│  │  Added Ghost variant style. Updated          ││
│  │  documentation links.                        ││
│  │                                              ││
│  │  ┌─ Changes vs v1.1.0 ───────────────────┐  ││
│  │  │  + Added variant: Style=Ghost          │  ││
│  │  │  + Added documentationLink:            │  ││
│  │  │    design-system.com/button            │  ││
│  │  │  ~ Changed description                 │  ││
│  │  └───────────────────────────────────────┘  ││
│  │                                              ││
│  │  ┌─ Audit Trail ─────────────────────────┐  ││
│  │  │ 10:15  Maria   Created draft          │  ││
│  │  │ 10:30  Maria   Submitted for review   │  ││
│  │  │ 11:00  Carlos  Approved               │  ││
│  │  │ 11:05  Maria   Published as v1.2.0    │  ││
│  │  └───────────────────────────────────────┘  ││
│  │                                              ││
│  │  [ Collapse ]  [ Export JSON ]  [ Restore ] ││
│  └──────────────────────────────────────────────┘│
```

#### Navigation Flow

```
┌─────────────────┐
│  Component List  │ <-- Default screen
│    (Screen 1)    │
└────────┬────────┘
         │
         ├── [Create Draft] --> extracts --> saves to Supabase --> goes to ──┐
         │                                                                   │
         ├── [View Draft] ──────────────────────────────────────────────────>│
         │                                                                   v
         │                                                   ┌──────────────────────┐
         │                                                   │  Version Detail      │
         │                                                   │  (Screen 2)          │
         │                                                   │                      │
         │                                                   │  Draft -> Review ->  │
         │                                                   │  Approve -> Publish  │
         │                                                   └──────────────────────┘
         │                                                               │
         │                                                     [< Back]  │
         │                                                               │
         ├── [History] ──────────────────────> ┌──────────────────────────┐
         │                                     │  Version History         │
         │                                     │  (Screen 3)             │
         │                                     │                         │
         │                                     │  Timeline of published  │
         │                                     │  versions               │
         │                                     └────────────┬────────────┘
         │                                                  │
         │                                  [View Details]  │
         │                                  navigates to ───┘──> Screen 2
         │
         └── [< Back] from any screen returns here
```

#### Visual Key

```
Status badge colors:
  * draft        ->  gray    (neutral, waiting for action)
  * in_review    ->  blue    (active, someone is looking)
  * approved     ->  yellow  (ready, needs publish action)
  * published    ->  green   (done, locked)
  * rejected     ->  red     (needs revision)

Semver bump badges:
  PATCH  ->  gray background     (1.2.0 -> 1.2.1)
  MINOR  ->  blue background     (1.2.0 -> 1.3.0)
  MAJOR  ->  orange background   (1.2.0 -> 2.0.0)

Diff line prefixes:
  +  added     (green)
  ~  changed   (yellow)
  -  removed   (red)
```

### 4.3 Shared UI usage
Import from `@figma-plugins/shared-ui`: Button, Tabs, Modal, Input, Dropdown
Use `theme` for all styling (colors, spacing, typography, borderRadius)

### 4.3 State management
React useState hooks (consistent with existing plugins). Key state:
- `components: ExtractedComponent[]`
- `versions: ComponentVersion[]`
- `currentView: 'list' | 'detail' | 'history'`
- `selectedComponent: string | null`
- `draftStatus: VersionStatus`

**Files to create:**
- `plugins/component-changelog/ui.tsx`

---

## Phase 5: Diff Engine

### 5.1 JSON diffing
Use `deep-diff` library to compute property-level diffs between two `JSON_REST_V1` snapshots.

### 5.2 Human-readable summaries
Transform raw diffs into readable changelog entries:
- "Added variant: Size=Large"
- "Changed fill color from #3B82F6 to #2563EB"
- "Updated padding from 8px to 12px"
- "Removed component property: IconRight"
- "Added drop shadow effect"

### 5.3 Diff stored on version creation
When creating a draft, compute diff against latest published version and store in `component_versions.diff`.

---

## Build & Verification

### Build
```bash
cd plugins/component-changelog
npm run build
# Equivalent to:
# esbuild code.ts --bundle --outfile=code.js --target=es2017
# esbuild ui.tsx --bundle --outfile=ui.js --target=es2017
# node inline-ui.js
```

### Test checklist
1. **Plugin loads**: Open in Figma, verify UI renders with dark mode support
2. **Component discovery**: Select components → verify they appear in the list
3. **Extraction**: Click "Create Draft" → verify JSON_REST_V1 data is captured correctly
4. **Supabase write**: Verify draft row appears in `component_versions` table
5. **Thumbnail**: Verify PNG uploads to Supabase Storage
6. **Approval flow**: Draft → Submit → Approve → Publish — verify status transitions and audit log
7. **Diff**: Modify a component, create new draft → verify diff highlights changes correctly
8. **Version history**: Verify timeline shows all published versions with changelogs
9. **Semver**: Verify version numbers increment correctly based on bump type
10. **Same-user approval**: Verify one user can complete the full flow (demo mode)

### Key existing patterns to reuse
- `inline-ui.js` — from `plugins/ds-adoption-tracker/inline-ui.js`
- `theme` + shared components — from `packages/shared-ui`
- Message typing pattern — discriminated unions from `plugins/ds-adoption-tracker/types.ts`
- Progress reporting — `sendProgress()` pattern from `plugins/ds-adoption-tracker/code.ts`
- Build scripts — esbuild config from `plugins/ds-adoption-tracker/package.json`
