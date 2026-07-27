---
'@ait-co/agent-plugin': patch
---

docs(claude-md): 3-패키지 경계 서술 + stale 4겹 환경 포인터 정정 (#281)

`CLAUDE.md`의 도구 경계 서술을 A1(#283)이 배선한 3-패키지 구조에 맞춘다.

- **3-패키지 경계 표 신설**: `@ait-co/devtools`(브라우저 dev, `devDependencies`) /
  `@ait-co/debugger`(MCP 데몬·러너, `devDependencies`·npx 전용) /
  `@ait-co/debug-console`(on-device attach, **프로덕션 번들에 들어갈 수 있는 유일한
  패키지**, `dependencies`)의 정체성·설치 위치·소비 지점을 표로 명시.
- **보안 스코프 축 한 문단**: "무엇이 앱 번들에 들어갈 수 있는가"가 각 패키지의
  `package.json`(dep vs devDep) 한 장으로 답해진다는 것을 명시.
- **stale `four-environments-fidelity.md` 포인터 정정**: 환경 모델이 4겹→3겹으로
  줄면서(환경 4 "live relay debug" 폐기) umbrella 쪽 설계 정본 파일명도
  `three-environments-fidelity.md`로 바뀌었다 — `CLAUDE.md`, `shared/skills/debug/SKILL.md`,
  `shared/skills/setup-phone-preview/SKILL.md`의 포인터 4곳을 갱신.
- **본문이 여전히 4겹을 전제하던 서술도 함께 정정**: `debug/SKILL.md`의 "환경 3→4 전환"
  (환경 4가 더 이상 없으므로 "환경 3 밖의 배포 상태 전환"으로 재서술), `eval/README.md`의
  "환경 4겹 분기 안내(… 3·4 MCP attach)" → "환경 3겹 분기 안내(… 3 MCP attach)".
- **PRIVATE umbrella repo를 가리키는 죽은 절대 URL 정정**: `shared/skills/debug/SKILL.md`,
  `shared/skills/setup-phone-preview/SKILL.md`, `shared/skills/welcome/SKILL.md`가
  `github.com/apps-in-toss-community/CLAUDE.md`를 절대 링크로 걸고 있었다 — umbrella는
  메인테이너 internal(PRIVATE) repo라 외부 사용자에게 404다. 같은 파일 안에서 이미 쓰이던
  plain-text `umbrella CLAUDE.md` 멘션 형태로 통일했다. `devtools`·`docs`·`console-cli` 등
  public repo를 가리키는 절대 URL은 그대로 유지.

동작 변경 없음 — 순수 서술 정리. `eval/e2e/driver.ts`·`shared/templates/` 무변경.
