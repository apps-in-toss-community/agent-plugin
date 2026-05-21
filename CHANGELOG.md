# @ait-co/agent-plugin

## 0.1.8

### Patch Changes

- 38872ab: Implement the Tier 1 skill-event POST in `sendTier1Event`. It now sends `{tier:1, source, event, anon_id, version, ts, meta?}` to the telemetry endpoint when effective consent is granted under the current policy, honoring the global `AITC_TELEMETRY` opt-out and the same fire-and-forget 5 s timeout as the Tier 0 ping. The metrics-ingest server already allowlists the `skill_invoked` event for this source.

## 0.1.7

### Patch Changes

- 9a3233a: feat: add /ait register skill for non-interactive app registration

  New `register` skill closes the harness gap between `/ait setup-bundle` and `/ait deploy`: it scaffolds the `aitcc.yaml` manifest non-interactively (the work the TTY-only `aitcc app init` does), discovers `workspaceId` / `categoryIds` via `aitcc whoami --json` and `aitcc app categories --selectable --json`, then runs `aitcc app register --json` (offers `--dry-run` first; `--accept-terms` only with explicit user consent). Never overwrites an existing manifest, uses the console session (not a Deploy Key), and never invokes interactive `aitcc login`.

- 1cef99d: fix: make `debug` and `inject-devtools` skills match shipped behavior

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

- b94ab8c: fix: setup-phone-preview writes onlyBuiltDependencies to pnpm-workspace.yaml (pnpm 10.33)

  - `setup-phone-preview` skill now adds `cloudflared` to `pnpm-workspace.yaml`'s `onlyBuiltDependencies` instead of the deprecated `package.json` `pnpm.onlyBuiltDependencies` field — pnpm 10.33 no longer reads the `pnpm` field and only warns. Updated frontmatter, step 3, the non-pnpm fallback, both completion summaries, and the out-of-scope/don't-do notes accordingly.
  - `react-vite` template `@ait-co/devtools` bumped `^0.1.12` → `^0.1.19`, matching the version the skill's preflight already requires.

- 1ac781e: refactor: sync plugin.json version, fix stale Codex claim, rename ait-console → aitcc, correct stub markers

  - `.claude-plugin/plugin.json` version synced to 0.1.6 (was stuck at 0.1.0)
  - README ko/en: clarify Claude Code is current target; Codex is a later phase (was "supports both Claude Code and Codex")
  - `package.json` description updated to match
  - `ait-console` references replaced with `aitcc` in CLAUDE.md, deploy skill, and deploy command description
  - `(stub)` markers removed from `ait-inject-devtools`, `ait-auth-setup`, `ait-logs` commands — skills were implemented in 0.1.3
  - CLAUDE.md Status section updated to reflect implemented vs. still-stub skills
  - README skill list reordered: working commands listed first, remaining stubs (deploy, debug) at the bottom with blocking reason

- 6b2fee2: fix: strip internal ops state and defensive labels from shipped skills

  - `status` skill: replace the real dog-food app/workspace identifiers in the summary example with generic placeholders, and rewrite the ops note that referenced specific internal miniApp IDs / REVIEW-lock codes into a generic "focus on the current project" guideline.
  - `auth-setup` skill: drop the internal miniApp ID from the live-validation note and replace the `비공식` label with the calm community open-source identity.
  - `inject-devtools` / `new-miniapp` skills: replace remaining `비공식 커뮤니티` labels (forbidden by the tone guide) with `커뮤니티 오픈소스`.
  - `README.en.md`: refer to the deployment-phases section by English description instead of quoting the Korean heading verbatim.

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
