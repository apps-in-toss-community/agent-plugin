---
"@ait-co/agent-plugin": patch
---

Implement `inject-polyfill` skill — replaces stub with full step machine.

Steps: package install (`pnpm add @ait-co/polyfill`), idempotent entry-point
wire-up (`import '@ait-co/polyfill/auto'`), optional README section, and
manual migration guide for Tier 1 API replacements (clipboard, geolocation,
share, vibrate, network, window.open).
