---
"@ait-co/agent-plugin": patch
---

feat: adapt templates and skills to @apps-in-toss/web-framework@3.0.0-beta

- template: bump web-framework dep to 3.0.0-beta.9d42c0b (exact); update build script to include `ait build`; replace deprecated @apps-in-toss/web-bridge + web-analytics with @apps-in-toss/webview-bridge in vite.config.ts optimizeDeps.exclude
- setup-bundle: remove @apps-in-toss/cli install step (ait bin is now built into web-framework); rename granite.config.ts → apps-in-toss.config.ts; update config schema (brand.primaryColor only, no web{} block, webBundleDir instead of outdir)
- deploy: rewrite deploy mechanism — replace dead `ait deploy --profile/--api-key/--scheme-only` with 3.0 two-step flow: `ait build` (produces .ait) then `aitcc app deploy <path>`; document deploymentId/scheme URL lookup via `aitcc app bundles ls`
- deploy-key: remove stale `ait deploy --profile` references; update to point to `aitcc app deploy` flow
- debug: update candidate bundle preparation steps to use `ait build` + `aitcc app deploy` instead of dead `ait deploy --scheme-only`
- plan/new-miniapp: update `@apps-in-toss/cli` description to reflect ait bin now ships from web-framework; fix granite.config.ts → apps-in-toss.config.ts reference
- register: fix stale `--api-key` description
