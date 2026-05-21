---
"@ait-co/agent-plugin": patch
---

fix(release): run the version+sync chain via a single npm script

`changesets/action` exec's its `version:` string directly (no shell), so
`pnpm changeset version && pnpm sync:plugin-version` passed `&&` as a literal
argument to the changeset CLI ("Too many arguments passed to changesets"),
breaking the release run. Move the chain into a `release:version` npm script
and point the workflow at `pnpm release:version`.
