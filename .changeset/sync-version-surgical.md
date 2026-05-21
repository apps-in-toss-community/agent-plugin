---
"@ait-co/agent-plugin": patch
---

fix(release): sync plugin.json version surgically to preserve Biome formatting

`sync-plugin-version.mjs` rewrote the whole manifest with `JSON.stringify(_, 2)`,
which expands the short `keywords` array to multiline — but Biome keeps it on one
line, so the regenerated Version Packages PR failed `pnpm lint`. Replace only the
`version` string value via a targeted regex, leaving the rest of the file's
formatting untouched.
