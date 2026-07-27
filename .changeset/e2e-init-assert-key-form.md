---
'@ait-co/agent-plugin': patch
---

슈트 B 드라이버가 존재하지 않는 슬래시 명령(`/ait new`)을 시키고 있던 것을 실제 키로 교정 (#226).

slash-command 키 표현이 확정됐다(2026-07-27 실측): **command 파일의 basename**이고(`ait-new`), 플러그인으로 얹히면 `ait:ait-new`가 된다. `"ait new"`(다단어)도 `"ait"`(단일 prefix)도 아니다 — `/ait new`는 `Unknown command: /ait`로 떨어진다.

드라이버 프롬프트를 `/ait-new`·`/ait-setup-bundle`로 바꾸고, "ait가 들어간 키가 하나라도 있으면 OK"였던 느슨한 init assert를 `ait-new` 명령 + `new-miniapp` skill 둘 다 노출됐는지로 정밀화했다(`exposesKey` 순수 함수로 분리 + 테스트 6건). 문서가 안내하는 `/ait <verb>` 표면과 실제 이름이 어긋나는 별개 결함은 #286이 추적한다.
