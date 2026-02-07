# Component Changelog — Website & Dashboard

Marketing landing page + read-only health dashboard for the Component Changelog Figma plugin. Built with Astro 5, React, and Supabase.

## Structure

```
src/
├── pages/
│   ├── index.astro                    # Landing page (static)
│   └── dashboard/
│       ├── index.astro                # Health overview (SSR)
│       ├── components/[key].astro     # Component detail (SSR)
│       └── audit.astro                # Activity timeline (SSR)
├── components/
│   ├── landing/                       # Landing page sections
│   │   ├── Hero.astro
│   │   ├── Features.astro
│   │   ├── HowItWorks.astro
│   │   └── CTA.astro
│   └── dashboard/                     # Dashboard components
│       ├── ProjectSelector.tsx        # React — project dropdown
│       ├── ComponentTable.tsx         # React — sortable table
│       ├── MetricCard.astro           # Coverage, drafts, versions
│       ├── VersionBadge.astro         # Status pill
│       └── AuditTimeline.astro        # Activity list
├── layouts/
│   ├── LandingLayout.astro
│   └── DashboardLayout.astro
└── lib/
    ├── data.ts                        # Re-exports from plugin supabase
    └── metrics.ts                     # Dashboard calculations
```

## Dev Commands

From the **monorepo root** (`Figma Plugins/`):

```bash
# Install all workspace dependencies
npm install

# Start dev server (http://localhost:4321)
npm run dev -w @figma-plugins/dashboard

# Production build
npm run build -w @figma-plugins/dashboard

# Preview production build
npm run preview -w @figma-plugins/dashboard
```

Or from `apps/dashboard/` directly:

```bash
npm run dev       # http://localhost:4321
npm run build
npm run preview
```

## How It Works

- The **landing page** (`/`) is prerendered at build time — pure static HTML.
- The **dashboard pages** (`/dashboard/*`) are server-rendered on each request via `@astrojs/node`, so they always show live Supabase data.
- Vite aliases (`@plugin/types`, `@plugin/supabase`) import directly from `plugins/component-changelog/` — no shared package needed, plugin code stays untouched.

## Design

- Dark theme matching the Figma plugin aesthetic
- Fonts: JetBrains Mono (headings), IBM Plex Mono (body)
- CSS custom properties for theming (`--bg-primary`, `--accent`, etc.)
- Dashboard scopes data via `?project=<id>` query param — no auth required

## Tech Stack

| Layer | Tech |
|-------|------|
| Framework | Astro 5 |
| Interactive | React 18 (`client:load`) |
| Data | Supabase (shared with plugin) |
| SSR | `@astrojs/node` (standalone) |
| Styling | Scoped CSS + CSS variables |
