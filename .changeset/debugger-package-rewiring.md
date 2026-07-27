---
'@ait-co/agent-plugin': patch
---

feat(skills): devtools 3-way split 반영 — MCP 데몬을 `@ait-co/debugger`로 재배선 + on-device attach 설치 안내 신설 (#280)

`@ait-co/devtools` 단일 패키지가 신규 repo `apps-in-toss-community/debugger`로 MCP 데몬·테스트
러너·on-device attach 표면을 분리하며 `@ait-co/debugger`(devDep/npx 전용) + `@ait-co/debug-console`
(on-device attach + eruda, 프로덕션 번들에 들어갈 수 있는 유일한 디버그 패키지) 2개 패키지로
출하됐다. `devtools`는 mock·panel·unplugin(브라우저 dev 필수품)만 남아 계속 devDep 전용이다.

- `.claude-plugin/plugin.json`: `mcpServers.ait-devtools`의 `command`를
  `npx -y -p @ait-co/debugger debugger`로 재배선. **server key `ait-devtools`는 개명하지
  않는다** — eval e2e `disallowedTools: ['mcp__ait-devtools']` 게이트가 이 문자열에
  결합돼 있어(`eval/e2e/driver.ts` 무변경), 개명하면 게이트가 조용히 fail-open된다.
- `shared/skills/debug/SKILL.md` + `references/mode-switching.md`: on-device MCP 데몬
  패키지·bin 참조를 `@ait-co/devtools devtools-mcp` → `@ait-co/debugger debugger`로 갱신.
  브라우저 mock/panel 문맥의 `@ait-co/devtools` 참조는 그대로 유지(판정 기준: 브라우저
  개발=devtools, 실기기/relay/CDP/MCP=debugger, 인앱 콘솔=debug-console).
- **신규 facet** `/ait inject-debug-console` (`inject` skill 3번째 facet): 오늘까지 플러그인·
  docs 어디에도 없던 `@ait-co/debug-console` 설치·와이어업 안내를 채운다 —
  `dependencies`(devDep 아님) 설치 + `/auto` self-gating import + 보안 스코프 설명(프로덕션
  번들에 실제로 들어갈 수 있는 유일한 디버그 패키지). command 표면 17→18
  (`shared/commands/ait-inject-debug-console.md` 신설).
- `scripts/validate-plugin.mjs`: `EXPECTED_CMD_TO_SKILL` + `MERGED_SECONDARY_FACET_CMDS`에
  신규 command 등재.
- bare-npx(`-p` 누락) drift 전수 정정: `CLAUDE.md`의 adapter 계약 JSON 예시.
- `eval/e2e/driver.ts`·`shared/templates/`는 무변경 — build-only 게이트 문자열과 eval
  baseline 비교성을 보존한다.
