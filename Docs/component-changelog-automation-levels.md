# Component Changelog — Automation Levels

From fully manual pipeline to fully automated. Each level builds on the previous one.

---

## Level 0: Fully Manual (Export/Import Files)

```
Designer → Plugin "Export JSON" button → downloads .json file to disk
Designer → Opens web app → uploads .json file → web app parses & stores in Supabase
Designer → Browses versions in web app
```

**What you build:**
- **Figma plugin**: Just the extraction part — a button that calls `exportAsync({ format: 'JSON_REST_V1' })` and triggers a file download via the UI iframe (`Blob` + `URL.createObjectURL`)
- **Web app** (Next.js/Remix/whatever): File upload form, JSON parser, Supabase write, version browser, diff viewer

**Pros:**
- Simplest plugin (almost no dependencies, no network access needed)
- Web app is a standard CRUD app — easy to build, test, deploy
- No auth complexity in the plugin at all
- Team can use the web app independently

**Cons:**
- Friction: download → switch context → upload → wait
- Easy to forget to snapshot
- No thumbnails unless you also export PNG manually
- Version messages are an afterthought

**Effort**: ~3-4 days total (1 day plugin, 2-3 days web app)

---

## Level 1: Plugin Exports, Web App Manages

```
Designer → Plugin "Export JSON" → saves .json + .png to a shared folder (Google Drive, Dropbox, local)
Separate script/cron → watches folder → auto-uploads new files to Supabase
Team → Browses versions in web app
```

**What you add:**
- Plugin exports both JSON + PNG thumbnail in a single action
- A small Node.js script or Supabase Edge Function watches a folder or S3 bucket
- Naming convention encodes metadata: `Button_v3_2024-02-06.json`

**Pros:**
- Still no network access needed in the plugin
- Batch-friendly (export 20 components at once)
- The watcher script handles parsing and diffing

**Cons:**
- Shared folder setup per team
- Naming conventions can break
- Still requires manual export trigger

**Effort**: ~5-6 days (1 day plugin, 2 days watcher, 2-3 days web app)

---

## Level 2: Plugin Talks Directly to Supabase

```
Designer → Plugin "Snapshot" button → Plugin extracts JSON + PNG → sends to Supabase directly
Designer → Browses history inside the plugin UI OR in a web app
```

**What you add:**
- `manifest.json` gets `networkAccess: { allowedDomains: ["*.supabase.co"] }`
- `@supabase/supabase-js` bundled in the UI iframe
- Plugin UI has: snapshot button, version list, diff viewer
- Anon key + RLS for auth

**This is the sweet spot for most teams.** You get:
- One-click snapshots with version messages
- Thumbnail generation is automatic
- Diff computed on save (previous version vs new)
- History browsable right inside Figma
- Web app becomes optional (nice-to-have dashboard)

**Cons:**
- Still manual trigger — designer must remember to click "Snapshot"
- Supabase credentials embedded in plugin (anon key is designed for this, but still)

**Effort**: ~8-10 days

---

## Level 3: Smart Triggers (Semi-Automated)

```
Designer publishes library → Plugin detects CHANGED status → prompts "Snapshot before publishing?"
Designer clicks yes → auto-extracts + stores → done
```

**What you add:**
- Background polling: periodically check `getPublishStatusAsync()` on tracked components
- `figma.on('documentchange', callback)` to detect property changes in real-time
- Smart batching: group rapid changes, only prompt after "quiet period"
- Optional: auto-snapshot on certain events (component rename, variant added/removed)

```ts
// Detect changes to tracked components
figma.on('documentchange', ({ documentChanges }) => {
  for (const change of documentChanges) {
    if (change.type === 'PROPERTY_CHANGE' && trackedComponentIds.has(change.id)) {
      // Queue a snapshot prompt
      debouncedPromptSnapshot(change.id);
    }
  }
});
```

**Pros:**
- Designers don't forget — the plugin nudges them
- Changes are captured closer to when they happen
- Can build "dirty" indicators (component has unsnapshot changes)

**Cons:**
- `documentchange` fires A LOT — need smart debouncing
- Can become annoying if too aggressive with prompts
- `loadAllPagesAsync()` needed for cross-page monitoring (slow on large files)

**Effort**: ~12-15 days

---

## Level 4: Fully Automated (Zero Designer Intervention)

```
Designer changes a component → Plugin auto-detects → auto-snapshots → auto-diffs → auto-stores
Changelog updates in real-time on the web dashboard
Webhooks notify Slack, trigger CI/CD, update documentation sites
```

**What you add:**
- **Auto-snapshot on save**: Use `documentchange` events + debounce to silently snapshot every meaningful change
- **Supabase Realtime**: Web dashboard subscribes to `component_versions` table — live updates
- **Supabase Edge Functions / Webhooks**: On new version insert:
  - Compute diff automatically (server-side)
  - Generate human-readable changelog (could use an LLM for summarization)
  - Post to Slack: "Button component updated: added Disabled variant, changed border-radius from 8px to 12px"
  - Trigger CI pipeline to regenerate code from latest component JSON
- **Figma Webhook** (REST API, not plugin): Listen to `FILE_VERSION_UPDATE` events at the file level as a backup trigger

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐     ┌──────────────┐
│ Figma Plugin │────>│   Supabase   │────>│ Edge Function│────>│ Slack/CI/Docs│
│ (auto-snap)  │     │   Database   │     │ (on insert)  │     │  (webhooks)  │
└─────────────┘     └──────────────┘     └─────────────┘     └──────────────┘
                           │
                           ▼
                    ┌──────────────┐
                    │  Web Dashboard│
                    │  (Realtime)   │
                    └──────────────┘
```

**Pros:**
- Zero friction for designers — they just design
- Complete audit trail of every change
- Downstream systems stay in sync automatically
- Can power design-to-code pipelines

**Cons:**
- Storage grows fast (every small change = new snapshot). Mitigation: store diffs, not full snapshots for minor changes; full snapshot only on "significant" changes
- Need smart change detection to avoid noise (ignore selection changes, undo/redo cycles)
- Plugin must handle being "always on" — memory/performance management
- More complex error handling (network failures, rate limits)

**Effort**: ~20-25 days

---

## Summary Table

| Level | Trigger | Plugin Complexity | Needs Web App? | Network in Plugin? | Best For |
|---|---|---|---|---|---|
| **0 - Manual files** | Export button + upload | Minimal | Yes (required) | No | Solo designer, exploring the idea |
| **1 - Folder watcher** | Export button + auto-ingest | Low | Yes (required) | No | Small team, existing file workflows |
| **2 - Direct to Supabase** | Snapshot button | Medium | Optional | Yes | Most teams — the sweet spot |
| **3 - Smart triggers** | Change detection + prompt | High | Optional | Yes | Design system teams with discipline |
| **4 - Fully automated** | Silent auto-snapshot | Very High | Yes (dashboard) | Yes | Orgs with design-to-code pipelines |

**Recommendation**: Start at **Level 0 or 2**. Level 0 to validate the concept fast with minimal investment. Level 2 if committed and want the real experience. Evolve toward Level 3-4 based on team feedback.
