---
'@ait-co/agent-plugin': patch
---

`docs`가 build 요청의 조사 단계로 오인돼 `plan`·`auth-setup`을 밀어내던 라우팅 약점 수정 (#275).

"필요한 SDK 도메인/권한/약관 정리해줘"(→`plan`), "로그인 배선해줘"(→`auth-setup`) 같은 발화에서 모델이 `docs`를 1단계 도구로 골라 정작 담당 skill이 안 뜨는 문제. `docs`의 description·command stub에 역-구분자를 넣고(조회 대상은 **사용자가 이미 이름을 댄 토픽 하나**, build 요청의 조사 단계가 아님) 본문에 `## Out of scope` 표를 추가했다.

슈트 A에 두 번째 러너 `eval/routing/`(`claude -p --plugin-dir`)을 추가한다 — 기존 promptfoo fixture는 skill을 project skill로 얹어 **실제 설치 형상**(skill이 `ait:` 네임스페이스 + command stub 17개 동반)을 재현하지 못했고, 그래서 이 약점을 못 잡고 있었다. API 키도 필요 없다.
