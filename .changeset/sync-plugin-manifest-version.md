---
"@ait-co/agent-plugin": patch
---

chore: auto-sync .claude-plugin/plugin.json version on release

`changeset version` only bumps `package.json`, so the plugin manifest
(`.claude-plugin/plugin.json`) drifted behind every release and had to be
hand-bumped (it was stuck at 0.1.8 while the package was 0.1.9). The release
workflow now runs `pnpm sync:plugin-version` right after `changeset version`,
copying the package version into the manifest so the Version Packages PR
always carries the synced manifest. Also re-syncs the manifest to 0.1.9.
