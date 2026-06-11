# @ait-co/agent-plugin

## 0.1.17

### Patch Changes

- 409d210: `debug` skill의 환경 2(relay-sandbox) single/dual-connection 데몬 분기 안내 정정 — 이 분기는 사용자가 만나지 않는 허구였다.

  devtools 소스 확인 결과 프로덕션 MCP bin 3개(`runDebugServer`/`runLocalDebugServer`/`runMobileDebugServer`)는 전부 `DualConnectionRouter`를 사용하므로, single-connection 데몬의 `relay-sandbox` 거부 에러는 테스트에서만 도달한다. plugin이 등록한 기본 데몬(`npx -y @ait-co/devtools devtools-mcp`)에서 `start_debug({mode:'relay-sandbox'})`는 재구동 없이 in-place 진입한다 — 진짜 전제는 외부 relay 주소(`AIT_RELAY_BASE_URL` 또는 `.ait_urls` 자동 발견)뿐이며, 이는 env-2가 unplugin이 띄운 외부 relay에 붙는 아키텍처 상수에서 온다. "데몬 재시작" 안내를 relay 주소 배선 안내(`/ait setup-phone-preview`)로 교체.

- e40517a: harness 유저 시나리오 seam 끊김 5건 정리 — zero→ship 흐름이 각 station에서 다음 station을 in-flow로 가리키도록 보강:

  - `new-miniapp` 다음-단계에 `/ait auth-setup` 추가 + `auth-setup`에 bridge client_id/Supabase provider 사전 조건 안내 단계(2.5) 신설 (코드 생성 전 외부 발급 경로를 인쇄)
  - `register`의 `/ait design` "미착수" 오기 정정(실제 구현됨) + 이미지 에러 실패 표에 `/ait design` cross-ref, `setup-bundle` 다음-단계에 design 추가
  - `ait-setup-bundle` 명령 description 파일명 오기(`apps-in-toss.config.ts` → `granite.config.ts`)
  - `status` 분기 표에 `serviceStatus: PREPARE`(검수 미제출) 행 추가 → `/ait debug` 환경 3 dog-food로 라우팅
  - 신규 `/ait welcome` skill — `/plugin install` 직후 station map + `/ait new`를 인쇄하는 station 0→1 hand-off

- 9da2ca0: terminology drift 정리 — ait-deploy description CLI 오기(`via aitcc` → `via ait deploy`), `Apps In Toss Community` 전치사 소문자, `딥링크`/`deep link` → `deep-link`, `AITC Sandbox PWA` → `AITC Sandbox App (PWA)`, `SDK mock` → `mock SDK`.

## 0.1.16

### Patch Changes

- bfaa09f: 환경 2 부트스트랩 추가 + `start_debug` mode enum 정정

  `/ait debug`가 환경 2(AITC Sandbox PWA) 경로에서 `pnpm dev:phone:cdp`를 직접 백그라운드로
  기동하고 `.ait_urls` 준비 완료 신호를 폴링한 뒤 attach로 이어가는 부트스트랩 절차를 추가했다.
  `start_debug` mode enum을 데몬 정본(`relay-sandbox`/`relay-staging`/`relay-live`/`local-browser`)으로
  정정하고, 환경 2 런타임 swap 제한을 single-connection vs dual-connection 데몬 구분으로 정확하게 서술했다.

- 5881d1f: 환경 2(AITC Sandbox PWA) CDP 터널 seam 배선

  setup-phone-preview skill의 tunnel 주입 형태를 sdk-example/vite.config.ts 정본에
  맞게 교정(`tunnel: process.env.AIT_TUNNEL ? { cdp: !!process.env.AIT_TUNNEL_CDP } : false`)하고,
  CDP relay용 `dev:phone:cdp` 스크립트를 추가했다.
  debug skill의 환경 2 진입 전제를 구체화해 `pnpm dev:phone:cdp`가 CDP relay
  (`AIT_RELAY_BASE_URL`/`AIT_TUNNEL_BASE_URL`)를 boot한다는 점과 `dev:phone`(screen-only)과의
  차이를 명시함으로써 `/ait setup-phone-preview` → `/ait debug`(환경 2) seam 절벽을 제거했다.

- 6fa5d1b: react-vite 템플릿과 관련 skills를 web-framework stable 2.x 기준선으로 되돌림.

  scaffold 기준선은 항상 stable(web-framework 2.x, devtools `latest`)이어야 하며, 3.0-beta는 GA flip 부분 선행 staging일 뿐 개발 base가 아니다.

  변경 내용:

  - `shared/templates/react-vite/package.json`: `@apps-in-toss/web-framework` `3.0.0-beta.9d42c0b` → `^2.6.0`, `build` 스크립트에서 `&& ait build` 제거
  - `shared/templates/react-vite/vite.config.ts`: `optimizeDeps.exclude`에서 `@apps-in-toss/webview-bridge` 제거, `@apps-in-toss/web-bridge`·`@apps-in-toss/web-analytics` 복구
  - `shared/skills/setup-bundle/SKILL.md`: `granite.config.ts` + `@apps-in-toss/cli` 설치 단계 + `outdir`/`web{}` 블록 포함 2.x 스키마 복구
  - `shared/skills/deploy/SKILL.md`: `ait deploy --profile` + `--scheme-only` 플로 복구
  - `shared/skills/deploy-key/SKILL.md`: `ait deploy --profile` 기반 배포 명령 복구
  - `shared/skills/debug/SKILL.md`: 환경 3 후보 빌드·배포 설명 2.x(`ait deploy --scheme-only`) 복구 (c593c71의 환경 2 MCP-attach 변경은 유지)
  - `shared/skills/new-miniapp/SKILL.md`, `plan/SKILL.md`, `register/SKILL.md`: 번들러 참조 복구

## 0.1.15

### Patch Changes

- 83103f4: feat: adapt templates and skills to @apps-in-toss/web-framework@3.0.0-beta

  - template: bump web-framework dep to 3.0.0-beta.9d42c0b (exact); update build script to include `ait build`; replace deprecated @apps-in-toss/web-bridge + web-analytics with @apps-in-toss/webview-bridge in vite.config.ts optimizeDeps.exclude
  - setup-bundle: remove @apps-in-toss/cli install step (ait bin is now built into web-framework); rename granite.config.ts → apps-in-toss.config.ts; update config schema (brand.primaryColor only, no web{} block, webBundleDir instead of outdir)
  - deploy: rewrite deploy mechanism — replace dead `ait deploy --profile/--api-key/--scheme-only` with 3.0 two-step flow: `ait build` (produces .ait) then `aitcc app deploy <path>`; document deploymentId/scheme URL lookup via `aitcc app bundles ls`
  - deploy-key: remove stale `ait deploy --profile` references; update to point to `aitcc app deploy` flow
  - debug: update candidate bundle preparation steps to use `ait build` + `aitcc app deploy` instead of dead `ait deploy --scheme-only`
  - plan/new-miniapp: update `@apps-in-toss/cli` description to reflect ait bin now ships from web-framework; fix granite.config.ts → apps-in-toss.config.ts reference
  - register: fix stale `--api-key` description

## 0.1.14

### Patch Changes

- 657c582: docs(skills/debug): `start_debug(mode)` 단일 진입 경로로 SKILL.md 갱신

  `MCP_ENV` 기반 서버 재구동 방식을 deprecated로 표시하고, 환경 전환의 정본 경로를
  `start_debug({mode})` 런타임 호출로 전환. mode 표(`local-browser-dev` / `local-browser-cdp`
  / `relay-dev` / `relay-live`), `relay-live`의 `confirm:true` 2중 게이트, attach 흐름의
  `start_debug` → `build_attach_url` 2단계를 명확히 기술. devtools #348/#356/#358 정합.

## 0.1.13

### Patch Changes

- 55f2ee0: /ait debug SKILL.md: on-device relay 동적 흐름 안내로 확장 (#81)

  `shared/skills/debug/SKILL.md` §5를 동적 attach 흐름 실행 안내로 확장한다. `MCP_ENV` 환경 자동 감지 설명(`mock`/`relay-dev`/`relay-live`), `ait build && ait deploy --scheme-only` candidate 번들 준비 단계(5-B), `build_attach_url` QR 발급 → 스캔 → attach 확인(5-C/5-D), attach 후 자동 등록되는 9종 도구 명세, bootstrap 3종 목록 업데이트, 관측 결과 분기 seam 확장, docs deep-link를 주제 페이지로 교체.

- 6b3cc40: plugin manifest에 `ait-devtools` MCP 서버 등록 — 환경 2·3 단일 MCP surface (#82)

  `.claude-plugin/plugin.json`의 `mcpServers`에 `devtools-mcp`(devtools repo 제공 bin)를 `npx -y @ait-co/devtools devtools-mcp`로 등록한다. 머신 절대경로 launcher가 아니라 published bin을 지목하므로 다른 머신 clone에서도 깨지지 않는다. plugin은 MCP를 자체 구현하지 않고 한 줄 등록만 한다(idle context는 attach 전 bootstrap 도구 2종으로 제한).

  `debug` skill을 환경 3종 분기로 확장: 환경 1(브라우저)은 기존대로, 환경 2·3(intoss-private candidate / live)은 `build_attach_url` QR로 on-device CDP relay attach 경로를 발급한다. attach 성공 시 `notifications/tools/list_changed`로 attach 의존 도구가 같은 세션에 동적 등록된다.

## 0.1.12

### Patch Changes

- 843002c: Add `argument-hint` frontmatter to the 11 `/ait *` command wrappers that were missing it (only `ait-docs` and `ait-new` had it). Each wrapper now mirrors its SKILL.md hint — argument-less commands carry an explicit `argument-hint: ''` per the skill-uniformity rule, so the agent shows a consistent hint for every command.

## 0.1.11

### Patch Changes

- ff8b345: Tighten /ait skill uniformity: add missing argument-hint to changeset/logs/status, add explicit next-station seams (auth-setup/deploy/status/docs/inject-devtools/inject-polyfill/setup-phone-preview), and normalize section vocabulary (logs opens with ## 목적; 짝 skill merged into ## 참고; header-adjacent blockquote banners removed).

## 0.1.10

### Patch Changes

- 41e2c1f: fix(release): run the version+sync chain via a single npm script

  `changesets/action` exec's its `version:` string directly (no shell), so
  `pnpm changeset version && pnpm sync:plugin-version` passed `&&` as a literal
  argument to the changeset CLI ("Too many arguments passed to changesets"),
  breaking the release run. Move the chain into a `release:version` npm script
  and point the workflow at `pnpm release:version`.

- 120f691: chore: auto-sync .claude-plugin/plugin.json version on release

  `changeset version` only bumps `package.json`, so the plugin manifest
  (`.claude-plugin/plugin.json`) drifted behind every release and had to be
  hand-bumped (it was stuck at 0.1.8 while the package was 0.1.9). The release
  workflow now runs `pnpm sync:plugin-version` right after `changeset version`,
  copying the package version into the manifest so the Version Packages PR
  always carries the synced manifest. Also re-syncs the manifest to 0.1.9.

- fc76249: fix(release): sync plugin.json version surgically to preserve Biome formatting

  `sync-plugin-version.mjs` rewrote the whole manifest with `JSON.stringify(_, 2)`,
  which expands the short `keywords` array to multiline — but Biome keeps it on one
  line, so the regenerated Version Packages PR failed `pnpm lint`. Replace only the
  `version` string value via a targeted regex, leaving the rest of the file's
  formatting untouched.

## 0.1.9

### Patch Changes

- 195cf2c: docs(deploy): clarify the two deploy paths in the out-of-scope note

  The `deploy` skill's "콘솔 로그인 불필요" bullet now spells out that this
  skill uses `ait deploy --api-key` (Deploy Key auth, the bundler CLI), and
  points to `aitcc app deploy` (console-cli) for the session-based path —
  keeping the `ait` vs `aitcc` boundary explicit.

- 76aad1d: fix: correct skill seams, plugin.json version, and TELEMETRY path

  - `new-miniapp` skill: step-6 seam now routes `setup-bundle → register → deploy` instead of jumping straight to `deploy`
  - `setup-bundle` skill: step-9 completion block now routes `register → deploy` instead of jumping straight to `deploy`
  - `plugin.json`: version synced to 0.1.8 (was stuck at 0.1.6, matching package.json and CHANGELOG)
  - `TELEMETRY.md`: `$(dirname "$0")/../../..` corrected to `../..` — command files are two levels below plugin root (`shared/commands/ait-*.md`), not three

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
