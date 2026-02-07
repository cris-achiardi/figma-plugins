# Component Changelog Plugin — Implementation Plan

## Context

Build a Figma plugin that extracts component data, stores versioned snapshots in Supabase with a manual approval pipeline, and can generate JSON to rebuild components. Version bumping follows development best practices: triggered manually after reviews and approvals — not automated.

**Approval flow**: Draft → Review (diff) → Approve → Pick Semver → Write Message → Publish Version
**Demo mode**: Same user can approve their own changes (enforceable later via RLS).

---

## Progress Overview

| Phase | Description | Status |
|-------|------------|--------|
| 1 | Plugin Scaffold + Supabase Schema | COMPLETE |
| 2 | Types + Supabase Client | COMPLETE |
| 3 | Sandbox Logic (code.ts) | COMPLETE |
| 4 | React UI (ui.tsx) | MOSTLY COMPLETE |
| 5 | Diff Engine | PARTIAL |
| — | OAuth 2 Flow (not in original plan) | COMPLETE |

### What's Working
- Full OAuth 2 flow: popup → edge function → `oauth_sessions` polling → auto-advance
- Plugin API component discovery with `loadAllPagesAsync` + `findAllWithCriteria`
- Variant grouping via ComponentSetNode (79 components, 155 variants on test library)
- Full approval pipeline: Draft → Submit → Approve → Publish with semver bumping
- Batch version status loading (single query via `getProjectVersionMaps`)
- Persistent component list (no re-scan when navigating back from detail)
- Thumbnail export during extraction
- Audit logging on all status transitions

### What's Remaining
- [ ] **Version Detail Screen polish** — match wireframe layout (thumbnail before/after, diff viewer, progress stepper)
- [ ] **Human-readable diff summaries** — transform raw `deep-diff` output into readable change entries
- [ ] **Version History Screen** — timeline of published versions per component (Screen 3)
- [ ] **Search/filter** in component list
- [ ] **Reconstruction** — rebuild component from stored JSON snapshot (stretch goal)
- [ ] **Export JSON** button for published versions
- [ ] **Reject with note** — review note input on rejection
- [ ] **Re-extract** — update an existing draft with fresh snapshot data
- [ ] **RLS policies** — enforce reviewer != creator in production

---

## Phase 1: Plugin Scaffold + Supabase Schema — COMPLETE

### Files created
```
plugins/component-changelog/
├── manifest.json       — plugin config with OAuth + network domains
├── package.json        — dependencies + esbuild build pipeline
├── tsconfig.json       — TypeScript config
├── types.ts            — shared type definitions
├── code.ts             — Figma sandbox logic
├── ui.tsx              — React UI
├── supabase.ts         — Supabase client + API functions
├── figma-api.ts        — Figma REST API client (NEW, not in original plan)
├── inline-ui.js        — HTML template with CSS tokens
```

### Supabase schema (deployed)
- `projects` — unique on `figma_file_key`
- `component_versions` — with approval workflow + unique constraint `(project_id, component_key, version)`
- `audit_log` — tracks all status transitions
- `figma_tokens` — stores OAuth access/refresh tokens per Figma user
- `oauth_sessions` — temporary polling table for OAuth callback (NEW, not in original plan)
- `thumbnails` storage bucket — public read

### Edge Functions
- `figma-oauth-callback` — exchanges OAuth code for tokens, writes to `oauth_sessions` + `figma_tokens`

### manifest.json (actual)
```json
{
  "name": "Component Changelog",
  "id": "component-changelog-001",
  "api": "1.0.0",
  "main": "code.js",
  "ui": "ui.html",
  "editorType": ["figma"],
  "documentAccess": "dynamic-page",
  "permissions": ["currentuser"],
  "networkAccess": {
    "allowedDomains": [
      "https://*.supabase.co",
      "https://*.supabase.in",
      "https://api.figma.com",
      "https://www.figma.com"
    ]
  }
}
```

---

## Phase 2: Types + Supabase Client — COMPLETE

### types.ts additions beyond original plan
- `FigmaUser` — OAuth user info
- `LibraryInfo`, `LibraryComponent` — REST API types (used for initial discovery, now secondary)
- `ComponentGroup` — UI grouping type
- `LocalComponentGroup` — Plugin API scan result with variant info
- `Project` — Supabase project row type
- Extended `UIMessage` with: `save-settings`, `load-settings`, `clear-settings`, `scan-local-components`
- Extended `CodeMessage` with: `settings-loaded`, `local-components`

### supabase.ts additions beyond original plan
- `getOrCreateProject()` — find or create project by file key
- `getProjectVersionMaps()` — batch query for all version statuses (replaced N+1 queries)
- `getActiveDraft()` — find latest non-published version for a component
- `getVersionById()` — single version lookup
- `getStoredToken()` / `refreshFigmaToken()` — OAuth token management
- Fixed `createDraft()` to bump version from latest published (avoids unique constraint violation)

### figma-api.ts (NEW — not in original plan)
- `getMe(token)` — get authenticated Figma user info
- `getFileInfo(fileKey, token)` — get file name
- `getFileComponents(fileKey, token)` — list file components via REST API
- `getLibraryInfo(fileKey, token)` — combined file info + component count

---

## Phase 3: Sandbox Logic (code.ts) — COMPLETE

### Implemented
- Plugin initialization with `showUI` + `skipInvisibleInstanceChildren`
- Init message with saved OAuth state from `clientStorage`
- **Component discovery via Plugin API** (not REST API as originally planned):
  - `figma.loadAllPagesAsync()` for cross-page discovery
  - `findAllWithCriteria({ types: ['COMPONENT_SET'] })` for component sets
  - `findAllWithCriteria({ types: ['COMPONENT'] })` for standalones
  - Native variant grouping via `ComponentSetNode.children`
- Component extraction: `JSON_REST_V1` snapshot + PNG thumbnail + property definitions + bound variables
- Batch extraction (`extractSelected`) and single extraction (`extractSingle`)
- Navigation via `scrollAndZoomIntoView`
- OAuth settings persistence via `figma.clientStorage` (save/load/clear)
- Progress reporting during extraction

### Not yet implemented
- Reconstruction from JSON snapshot (stretch goal)

---

## Phase 4: React UI (ui.tsx) — MOSTLY COMPLETE

### Screen 0: Auth Screen — COMPLETE
- "Connect with Figma" button opens OAuth popup
- Polls `oauth_sessions` table every 2s for token
- Auto-advances to library setup on successful auth
- Logout clears stored token

### Screen 1: Library Setup — COMPLETE
- Paste Figma file URL or key
- Validates via REST API (`getLibraryInfo`)
- Shows file name and component count
- Creates/gets project in Supabase

### Screen 2: Library Components (Component List) — COMPLETE (needs polish)
- Uses Plugin API scan for component discovery
- Expandable component set rows with variant counts
- Version status badges (published version, active draft status)
- "Create Draft" button per component (with loading state)
- "View Draft" / version navigation to detail screen
- Batch version status loaded via single query
- Persistent mount — stays mounted when navigating to detail screen
- Refreshes version maps when becoming visible again

**Remaining polish to match wireframes:**
- [ ] Search/filter bar
- [ ] Thumbnail previews in list view (currently skipped for scan speed)
- [ ] "Extract All" bulk action
- [ ] Publish status dots (green/yellow/gray)

### Screen 3: Version Detail / Approval Pipeline — PARTIAL
- Basic approval pipeline works: Draft → Submit → Approve → Publish
- Semver picker (patch/minor/major) on publish
- Changelog message input on publish

**Remaining to match wireframes:**
- [ ] Progress stepper visualization (draft → review → approved → published)
- [ ] Thumbnail before/after comparison
- [ ] Human-readable diff viewer (currently shows raw diff or nothing)
- [ ] Review note input on reject
- [ ] Audit trail display
- [ ] Published read-only state with full changelog

### Screen 4: Version History — NOT STARTED
- [ ] Timeline of published versions per component
- [ ] Expand to see diff + audit trail
- [ ] "Export JSON" button
- [ ] "Restore" button (future)

---

## Phase 5: Diff Engine — PARTIAL

### Implemented
- `deep-diff` dependency installed
- Raw diff computed when creating drafts (stored in `component_versions.diff`)

### Not yet implemented
- [ ] Human-readable diff summaries (transform raw diffs into readable entries)
- [ ] Diff viewer UI component with color-coded changes
- [ ] Variant-level change detection ("Added variant: Size=XLarge")
- [ ] Property-level change descriptions ("Changed fill color from #3B82F6 to #2563EB")

---

## OAuth 2 Flow — COMPLETE (not in original plan)

### Architecture
1. Plugin UI opens popup to `figma.com/oauth` with state parameter
2. Figma redirects to Edge Function `figma-oauth-callback` with code + state
3. Edge Function exchanges code for tokens via Figma API
4. Edge Function upserts tokens into `figma_tokens` table
5. Edge Function writes to `oauth_sessions` table with state key
6. Plugin polls `oauth_sessions` by state every 2s
7. On match: stores token/fileKey/userName via `figma.clientStorage`, cleans up session row
8. Session persists across plugin reopens

### Why polling instead of postMessage
Figma plugin UI runs in a sandboxed iframe. `window.opener.postMessage` from the OAuth popup cannot reach it. Polling the database is the reliable workaround.

### Scopes requested
All non-Enterprise Figma OAuth scopes: `files:read`, `file_variables:read`, `file_variables:write`, `file_comments:write`, `file_dev_resources:read`, `file_dev_resources:write`, `webhooks:write`, `library_analytics:read`, `org_dev_resources:read`, `org_dev_resources:write`

---

## Next Steps (Priority Order)

### 1. Version Detail Screen — Diff Viewer + Polish
- Build the human-readable diff engine (Phase 5.2)
- Add progress stepper UI (draft → review → approved → published)
- Add thumbnail before/after comparison
- Add review note input on rejection
- Add audit trail display

### 2. Version History Screen (Screen 3)
- Timeline of published versions
- Expandable entries with diff + audit trail
- "Export JSON" button to download snapshot

### 3. Component List Polish
- Search/filter bar
- Publish status indicator dots
- Optional thumbnail previews

### 4. Stretch Goals
- Reconstruction from stored JSON snapshot
- Bulk "Extract All" action
- RLS policies for multi-user enforcement
- Token refresh flow (currently requires re-auth on expiry)

---

## Build & Verification

### Build
```bash
cd plugins/component-changelog
npm run build
# Runs: build:code → build:ui → inline-ui
# Output: code.js (~8.7kb) + ui.js (~1.5mb) + ui.html (inlined)
```

### Test checklist
1. **Plugin loads**: Open in Figma, verify UI renders with dark theme ✅
2. **OAuth flow**: Connect → popup → poll → auto-advance ✅
3. **Library setup**: Paste file URL → validate → show component count ✅
4. **Component discovery**: Plugin API scan with variant grouping ✅
5. **Extraction**: Click "Create Draft" → JSON_REST_V1 + PNG captured ✅
6. **Supabase write**: Draft row appears in `component_versions` ✅
7. **Thumbnail**: PNG uploads to Supabase Storage ✅
8. **Approval flow**: Draft → Submit → Approve → Publish with semver ✅
9. **Batch loading**: Version statuses load instantly via single query ✅
10. **Navigation**: Back from detail preserves component list state ✅
11. **Diff**: Modify a component, create new draft → verify diff highlights changes ⬜
12. **Version history**: Timeline of published versions with changelogs ⬜
13. **Same-user approval**: One user can complete the full flow (demo mode) ✅

### Key patterns used
- `inline-ui.js` — custom CSS token system (NOT shared-ui)
- Fonts: JetBrains Mono (headings) + IBM Plex Mono (body)
- Message typing — discriminated unions (`UIMessage` / `CodeMessage`)
- Progress reporting — `sendProgress()` pattern
- Build scripts — esbuild triple-stage pipeline
- OAuth polling — `oauth_sessions` table + `setInterval`