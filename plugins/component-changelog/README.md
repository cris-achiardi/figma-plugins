# Component Changelog

Version-controlled component changelog with Supabase-backed approval pipeline for Figma.

## Setup

```powershell
cd plugins/component-changelog
npm install
```

## Build

```powershell
# Full build (PowerShell)
npx esbuild code.ts --bundle --outfile=code.js --target=es2017; npx esbuild ui.tsx --bundle --outfile=ui.js --target=es2017; node inline-ui.js

# Or run each step separately
npx esbuild code.ts --bundle --outfile=code.js --target=es2017
npx esbuild ui.tsx --bundle --outfile=ui.js --target=es2017
node inline-ui.js
```

> `npm run build` also works if your shell supports `&&` chaining (cmd.exe, bash, PowerShell 7+).

## Architecture

```
code.ts        Figma sandbox — component discovery, extraction, navigation
ui.tsx         React UI — analyze, approve, publish workflow
supabase.ts    Supabase client — CRUD for versions, audit log, thumbnails
types.ts       Shared types and message contracts
inline-ui.js   Build step — inlines compiled ui.js into HTML template with CSS tokens
```

## Workflow

1. **Analyze** — lightweight scan of page/selection, discovers components via instance resolution
2. **Extract** — exports JSON snapshots + PNG thumbnails for selected components
3. **Draft** — creates a versioned draft in Supabase with diff against last published
4. **Review** — submit for review, approve or reject
5. **Publish** — semver bump (patch/minor/major) with changelog message

## Supabase

- Project: `nwweqcjiklzmlmvbfjkt.supabase.co`
- Tables: `projects`, `component_versions`, `audit_log`
- Storage: `thumbnails` bucket (public read)
