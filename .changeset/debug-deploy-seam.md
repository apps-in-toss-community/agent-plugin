---
'@ait-co/agent-plugin': patch
---

docs(debug): env3 scheme-URL seam을 자동 carry로 강화 (#266)

- `shared/skills/debug/SKILL.md` 5-B: candidate scheme URL이 없을 때 에이전트가
  `/ait deploy`를 dispatch하고 완료 출력의 `intoss-private://...` URL을 직접 읽어
  5-C의 `start_attach`로 전달 — 사용자가 URL을 복사·재입력하지 않아도 된다.
- 5-C env3 step 2: `/ait deploy`가 돌려준 scheme URL을 에이전트가 그대로 전달
  (`scheme_url`)함을 명시.
- `하지 말아야 할 것`: `ait deploy`를 이 skill에서 직접 Bash로 호출하지 않는다는
  eval e2e canUseTool 게이트 가드 bullet 추가.
- `다음 단계`: env3 분기 설명을 "복사 없음 — 5-B 참조"로 정렬.
- 콘솔 변이는 `/ait deploy` skill 경계 안에서 일어남을 명시 — 이 skill은
  read-only/build-only 상태 유지.
