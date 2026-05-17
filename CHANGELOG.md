# @ait-co/agent-plugin

## 0.1.6

### Patch Changes

- 90cad19: feat(telemetry): Tier 0 익명 사용 신호 + shared/telemetry 공통 helper 추가

  `shared/telemetry-state.ts` — 텔레메트리 상태 파일 모듈.
  `~/.config/aitc-agent-plugin/telemetry.json` (XDG 준수, atomic write, 0700/0600).
  `CURRENT_POLICY_VERSION = '2026-05-18'`, `resolveEffectiveConsent`(정책 버전 stale 체크),
  `readState`/`writeState`, UUID v4 anonId, tier0OptOut 플래그.

  `shared/telemetry.ts` — 공통 helper.
  `sendTier0Ping(version)` — opt-out 체크(env `AITC_TELEMETRY=off`, `tier0OptOut` 플래그), 일별 dedupe,
  POST to `https://t.aitc.dev/e` (`tier:0`), 5s timeout, fire-and-forget.
  `sendTier1Event` — stub (consent 체크만, HTTP 미구현; follow-up PR에서 wiring).

  `shared/telemetry-ping.ts` — 얇은 CLI shim. skill 진입점(command 파일)에서
  `node --import tsx/esm ... telemetry-ping.ts <version>` 으로 호출.

  `shared/TELEMETRY.md` — agent runtime 이 prelude를 실행하는 방법 명세.
  모든 `shared/commands/ait-*.md`가 이 문서를 참조하도록 업데이트.

  첫 ping 성공 시 1회 안내 메시지(stderr). README ko + en에 텔레메트리 섹션 추가.
  기존 skills/commands의 SKILL.md 본문은 변경 없음.

  agent-plugin 자체 state 파일 사용 (console-cli `~/.config/aitcc/` 재활용 안 함):
  독립 동작 보장, host process 권한 분리, 정책 버전 독립 evolve 가능.

  TypeScript 인프라(tsconfig, tsx, vitest, @types/node) 추가. 테스트 16개.

  ***

  feat(telemetry): add Tier 0 anonymous usage signal + shared/telemetry helper

  `shared/telemetry-state.ts` — persistent state module.
  Path: `~/.config/aitc-agent-plugin/telemetry.json` (XDG-compliant, atomic write,
  0700 dir / 0600 file). CURRENT_POLICY_VERSION = '2026-05-18'.
  Exports: `resolveEffectiveConsent` (stale policy → undecided; denied stays sticky),
  `readState` / `writeState`, UUID v4 anonId, `tier0OptOut` flag.

  `shared/telemetry.ts` — shared helpers.
  `sendTier0Ping(version)` — checks opt-out (env `AITC_TELEMETRY=off`, `tier0OptOut`
  flag), daily UTC dedupe, POSTs `{tier:0, source, version, platform, policy_version}`
  to `https://t.aitc.dev/e` with 5 s timeout, fire-and-forget (errors swallowed).
  First successful ping prints a one-time notice to stderr.
  `sendTier1Event` — stub only; consent check in place, HTTP POST is a follow-up.

  `shared/telemetry-ping.ts` — thin CLI shim called by skill entry points via
  `node --import tsx/esm ... telemetry-ping.ts <version>`.

  `shared/TELEMETRY.md` — documents the prelude contract for the agent runtime.
  All `shared/commands/ait-*.md` updated to reference this prelude (SKILL.md bodies
  untouched).

  README (ko + en) updated with telemetry section: Tier 0 data description, opt-out
  instructions, privacy link.

  Decision — own state file, not reusing console-cli's `~/.config/aitcc/`:
  independent operation (agent-plugin works without console-cli), separate host
  process permissions, allows policy versions to evolve independently.

  TypeScript infra added (tsconfig, tsx, vitest, @types/node). 16 unit tests.

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
