---
"@ait-co/agent-plugin": patch
---

fix: setup-phone-preview writes onlyBuiltDependencies to pnpm-workspace.yaml (pnpm 10.33)

- `setup-phone-preview` skill now adds `cloudflared` to `pnpm-workspace.yaml`'s `onlyBuiltDependencies` instead of the deprecated `package.json` `pnpm.onlyBuiltDependencies` field — pnpm 10.33 no longer reads the `pnpm` field and only warns. Updated frontmatter, step 3, the non-pnpm fallback, both completion summaries, and the out-of-scope/don't-do notes accordingly.
- `react-vite` template `@ait-co/devtools` bumped `^0.1.12` → `^0.1.19`, matching the version the skill's preflight already requires.
