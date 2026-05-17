---
"@ait-co/agent-plugin": patch
---

feat(telemetry): Tier 0 익명 사용 신호 + shared/telemetry 공통 helper 추가

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

---

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
