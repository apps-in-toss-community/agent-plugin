---
"@ait-co/agent-plugin": patch
---

fix: make `debug` and `inject-devtools` skills match shipped behavior

- `debug` skill is no longer a TODO stub. It now guides through the
  debugging surface that ships today — the `@ait-co/devtools` floating panel,
  the `window.__ait` runtime mock state, and the browser's own DevTools —
  and describes the in-progress on-device CDP relay surface as the next step
  rather than implying it already works.
- `inject-devtools` skill drops the `--mcp` flag and the
  `/api/ait-devtools/state` endpoint guidance. The shipped `@ait-co/devtools`
  unplugin exposes no `mcp` option (only `tunnel`), so the flag did nothing;
  removing it keeps the skill honest. Real-device preview lives in
  `/ait setup-phone-preview` (the `tunnel` option).
