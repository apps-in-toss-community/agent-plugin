# @ait-co/agent-plugin

## 0.1.5

### Patch Changes

- ed27cf2: fix(docs-skill): add recipes/ to resolving order — topics like haptic-feedback, copy-paste-ux, deeplink-routing were silently falling through to "not found" even though docs/docs/recipes/ has 20+ files. Also updates structure diagram and sdk-example URL to aitc.dev.

## 0.1.4

### Patch Changes

- acc58b9: chore: align homepage URLs to aitc.dev (canonical org domain).
- 6e9fa22: feat(skill): add setup-phone-preview skill — wires devtools quick-tunnel + launcher PWA flow into Vite projects with one command.

## 0.1.3

### Patch Changes

- 105d9d1: Implement `inject-polyfill` skill — replaces stub with full step machine.

  Steps: package install (`pnpm add @ait-co/polyfill`), idempotent entry-point
  wire-up (`import '@ait-co/polyfill/auto'`), optional README section, and
  manual migration guide for Tier 1 API replacements (clipboard, geolocation,
  share, vibrate, network, window.open).

- 7271614: Implement auth-setup skill with oidc-bridge zero-code mode integration guide.
- b800f52: feat(skills): implement inject-devtools skill

  stub → fully implemented. 기존 Vite/Next.js/Rspack/Webpack 프로젝트에
  `@ait-co/devtools` unplugin을 주입하는 절차를 단계별로 기술한다:
  빌드 도구 감지, 패키지 매니저 감지, 설치, config 파일 idempotent 패치,
  `--mcp` 옵션 지원. `@ait-co/devtools` 0.1.17+ unplugin API 기준.

- 9d31caf: feat(skills): implement logs (deferred guidance) + finalize status skill

  `logs` skill — `aitcc logs` endpoint 부재를 명시하고 events catalog, metrics, browser DevTools, 프로덕션 텔레메트리 네 가지 대안을 안내한다.

  `status` skill — 이미 구현된 SKILL.md를 공식 완성으로 확정 (stub → implemented).

## 0.1.2

### Patch Changes

- 4169520: feat(skills): implement `new-miniapp` skill (was placeholder) with a working `react-vite/` template — React 19 + Vite + TypeScript + `@ait-co/devtools` dev-dep + `@apps-in-toss/web-framework` 2.5.x. The skill copies the template, substitutes `{{app_name}}` / `{{package_name}}` tokens (text files only — no `mustache`/`handlebars` dep), and runs the initial `pnpm install` so `pnpm dev` works immediately. Out of scope: console auth, app registration, deploy (separate skills). `react-vite-polyfill/` and `react-vite-supabase/` variants stay as follow-ups.

## 0.1.1

### Patch Changes

- bef132e: chore(deps): bump @biomejs/biome to 2.4.15
- 6c48a93: docs(skills): align `docs` skill resolver with actual content structure (root `intro`, `api/<group>/index.mdx`, `guides/`); drop unbacked sections (`getting-started`, `recipes`, `reference`) from the spec but keep them as future-extension hooks. Implement `status` skill (was placeholder) on top of `aitcc whoami` / `app ls` / `app status` — read-only console summary.
