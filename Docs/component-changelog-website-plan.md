# Plan: Component Changelog Website (Landing + Dashboard)

Single Astro app with two parts: a marketing/pitch landing page and a read-only dashboard. Same app, one deploy.

---

## Work Split

| Who | What | Where |
|-----|------|-------|
| **Cris** | Monorepo setup, Astro scaffold, data layer, dashboard pages, wiring | `apps/dashboard/` setup + `src/lib/` + `src/pages/dashboard/` |
| **Teammate** | Landing page UI/prototype, visual polish | `src/pages/index.astro` + `src/components/landing/` |

---

## Monorepo Structure

```
Figma Plugins/
├── apps/
│   └── dashboard/                  ← New Astro app
│       ├── src/
│       │   ├── pages/
│       │   │   ├── index.astro              ← Landing page (teammate)
│       │   │   └── dashboard/
│       │   │       ├── index.astro           ← Health overview
│       │   │       ├── components/[key].astro ← Component detail
│       │   │       └── audit.astro           ← Activity timeline
│       │   ├── components/
│       │   │   ├── landing/                  ← Landing page components (teammate)
│       │   │   │   ├── Hero.astro
│       │   │   │   ├── Features.astro
│       │   │   │   ├── HowItWorks.astro
│       │   │   │   └── CTA.astro
│       │   │   └── dashboard/                ← Dashboard components (Cris)
│       │   │       ├── ProjectSelector.tsx
│       │   │       ├── MetricCard.astro
│       │   │       ├── ComponentTable.tsx
│       │   │       ├── VersionBadge.astro
│       │   │       └── AuditTimeline.astro
│       │   ├── layouts/
│       │   │   ├── LandingLayout.astro       ← Landing page layout
│       │   │   └── DashboardLayout.astro     ← Dashboard layout
│       │   └── lib/
│       │       ├── data.ts                   ← Re-exports from plugin supabase
│       │       └── metrics.ts                ← Health calculations
│       ├── public/
│       ├── astro.config.mjs
│       ├── package.json
│       └── tsconfig.json
├── packages/shared-ui/
├── plugins/
│   └── component-changelog/       ← Untouched
├── Docs/
└── package.json                   ← Add "apps/*" to workspaces
```

## Shared Code Strategy

Direct imports via Vite aliases — no shared package. Astro/Vite resolves the plugin's `.ts` files:

```js
// astro.config.mjs → vite.resolve.alias
'@plugin/types'    → '../../plugins/component-changelog/types.ts'
'@plugin/supabase' → '../../plugins/component-changelog/supabase.ts'
```

Plugin stays untouched.

---

## Part 1: Landing Page (Teammate)

Marketing/pitch page at `/` with CTA to `/dashboard`.

### Sections
1. **Hero** — headline, tagline, CTA button → `/dashboard`
2. **Problem** — "Design systems break silently" — pain point for judges
3. **Features** — 3-4 cards: version tracking, diff engine, approval pipeline, health dashboard
4. **How it works** — 3 steps: connect library → track changes → publish versions
5. **CTA** — "Try the dashboard" → `/dashboard`

### Design Direction
- Dark theme (matches plugin aesthetic)
- Fonts: JetBrains Mono (headings), IBM Plex Mono (body)
- Terminal/dev aesthetic — monospace, subtle grid, accent color
- CSS custom properties for theming:
  ```css
  --bg-primary: #1a1a2e;
  --bg-secondary: #16213e;
  --bg-tertiary: #0f3460;
  --text-primary: #e0e0e0;
  --text-secondary: #a0a0a0;
  --accent: #00d4aa;
  --diff-added: #2ea043;
  --diff-removed: #f85149;
  ```

### Layout
- `LandingLayout.astro` — full-width, no sidebar, nav with "Dashboard" link
- Responsive: single column on mobile, wider sections on desktop
- No React needed — all static Astro components

---

## Part 2: Dashboard (Cris)

Read-only health dashboard at `/dashboard/`. No auth — project selector scopes data.

### Pages

**`/dashboard/`** — Health overview
```
┌─────────────────────────────────────────┐
│ [Project Selector ▼]                    │
├────────┬────────┬────────┬──────────────┤
│  85%   │   3    │  12    │   v2.1.0     │
│Coverage│ Drafts │Versions│Latest Release│
├─────────────────────────────────────────┤
│ Component Table                         │
│ Name        │ Version │ Status │Updated │
│ Button      │ v2.1.0  │ ✓ pub  │ 2h ago │
│ Card        │ v1.3.0  │ ◉ draft│ 1d ago │
│ Icon/Arrow  │ v1.0.0  │ ✓ pub  │ 3d ago │
└─────────────────────────────────────────┘
```

**`/dashboard/components/[key]`** — Component detail
```
┌─────────────────────────────────────────┐
│ ← Back to overview                      │
│ Button                    v2.1.0 [pub]  │
├─────────────────────────────────────────┤
│ [Thumbnail]                             │
├─────────────────────────────────────────┤
│ Version History                         │
│ v2.1.0  patch  "Fix hover state"  2h   │
│ v2.0.0  major  "Full redesign"    5d   │
│ v1.5.0  minor  "Add icon variant" 2w   │
└─────────────────────────────────────────┘
```

**`/dashboard/audit`** — Activity timeline
```
┌─────────────────────────────────────────┐
│ Recent Activity                         │
│ ● Button v2.1.0 published      2h ago  │
│ ● Button v2.1.0 approved       3h ago  │
│ ● Card v1.3.0 draft created    1d ago  │
│ ● Icon v1.0.0 published        3d ago  │
└─────────────────────────────────────────┘
```

### Components

| Component | Type | Interactive? |
|-----------|------|-------------|
| `ProjectSelector.tsx` | React | Yes (`client:load`) — dropdown, navigates via `?project=id` |
| `MetricCard.astro` | Astro | No — label + value display |
| `ComponentTable.tsx` | React | Yes (`client:load`) — sortable, clickable rows |
| `VersionBadge.astro` | Astro | No — status pill |
| `AuditTimeline.astro` | Astro | No — chronological list |

### Layout
- `DashboardLayout.astro` — sidebar or top nav with project selector, dark theme, max-width container
- Same CSS variables as landing page

### Data Layer

**`src/lib/data.ts`** — re-exports read-only functions:
```ts
import { supabase } from '@plugin/supabase';
// Re-export: getProjectVersionMaps, getVersionHistory, getAuditLog,
//            getLibraryVersionHistory, getLatestPublished
```

**`src/lib/metrics.ts`** — dashboard-specific calculations:
```ts
calculateCoverage(projectId)   → % of components with published versions
calculateDrift(projectId)      → count of unpublished drafts
getRecentActivity(projectId)   → publishes in last 30 days
getComponentSummaries(projectId) → unique components + latest version
```

### Data Sources (all read-only, existing Supabase functions)
- `supabase.from('projects').select('*')` — project list
- `getProjectVersionMaps(projectId)` — all component versions
- `getVersionHistory(componentKey, projectId)` — per-component history
- `getAuditLog(versionId)` — activity trail
- `getLibraryVersionHistory(projectId)` — library releases

---

## Setup Steps (in order)

1. Add `"apps/*"` to root `package.json` workspaces
2. Create `apps/dashboard/` with package.json, astro.config.mjs, tsconfig.json
3. `npm install` from root
4. Create layouts (Landing + Dashboard)
5. Create `/dashboard/` pages + data layer (Cris)
6. Create `/` landing page (teammate, in parallel)
7. Test: `npm run dev -w @figma-plugins/dashboard` → localhost:4321

## Running Locally

```bash
# From monorepo root
npm install
npm run dev -w @figma-plugins/dashboard
# Opens at http://localhost:4321
```

## Verification

1. `/` shows landing page with CTA
2. `/dashboard` loads projects from Supabase, shows health metrics
3. `/dashboard/components/[key]` shows version history
4. `/dashboard/audit` shows activity timeline
5. Plugin still builds: `npm run build -w component-changelog`
