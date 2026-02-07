# Plan: Add Personal Access Token (PAT) Auth to Component Changelog

## Context

The plugin currently only supports OAuth 2 for Figma authentication. This requires the Figma OAuth app to be approved by org admins, which blocks teammates outside the organization from testing. Figma Personal Access Tokens (PATs) use the same REST API bearer auth and don't require OAuth app approval — any Figma user can generate one at figma.com/settings.

The existing architecture already treats the token as a generic string throughout the app (storage, API calls, message passing), so PAT support only requires changes to the **AuthScreen** component and a small validation call. No changes needed to code.ts, types.ts, figma-api.ts, or supabase.ts.

## Changes

### 1. `ui.tsx` — AuthScreen component (~lines 400-468)

- Add a toggle/link below the OAuth button: `"or use a personal access token"`
- When toggled, show a text input + "Connect" button instead of the OAuth button
- On submit:
  1. Call `getMe(token)` from figma-api.ts to validate the PAT
  2. If valid, call `onAuthenticated(token, user.handle)` (same callback as OAuth)
  3. If invalid, show error message
- Keep the existing OAuth flow fully intact (no modifications to it)
- Add a small help text linking to Figma's PAT generation page

### 2. `figma-api.ts` — already has `getMe()` (no changes needed)

`getMe(token)` already exists and returns user info. It works with both OAuth tokens and PATs. We'll use it to validate the PAT and get the user's name.

## Files touched

| File | Change |
|------|--------|
| `plugins/component-changelog/ui.tsx` | Add PAT input UI to AuthScreen |

That's it — one file.

## What stays untouched

- `code.ts` — token storage is already generic
- `types.ts` — message types already support any token string
- `figma-api.ts` — bearer auth works for both token types
- `supabase.ts` — no changes needed
- OAuth flow — completely preserved, PAT is just an alternative path

## Multi-library notes

- Each library creates a separate `project` row in Supabase (keyed by `figma_file_key`)
- All component data is isolated per project via `projectId` filtering
- Only one library is active at a time in the plugin session
- "Change library" button allows switching without re-authenticating
- PAT auth is completely independent of the library/project model

## Verification

1. `npm run build` in `plugins/component-changelog`
2. Import plugin in Figma Desktop → run it
3. Test OAuth flow still works (click "Connect with Figma")
4. Test PAT flow:
   - Generate a PAT at figma.com → Settings → Personal access tokens
   - Click "use a personal access token" link
   - Paste the token → click Connect
   - Should validate and proceed to Library Setup screen
5. Test invalid PAT → should show error
6. Test that after PAT auth, library setup + component scanning work normally
