---
'@ait-co/agent-plugin': patch
---

문서가 안내하던 `/ait <verb>`가 실재하지 않는 명령이던 것을 `/ait:<verb>`로 정정 (#286)

설치 형상에서 플러그인 이름이 네임스페이스가 되므로 사용자가 실제로 치는 형태는
`/ait:<verb>`이고, 공백 형태는 `Unknown command: /ait`로 끝났다. facet command
6개를 bare verb로 개명해(`ait-new.md`→`new.md` 등) 문서화된 18개 verb 전부가
`/ait:<verb>`로 해석되도록 맞추고, skill seam·README·CLAUDE.md의 표기를 정정했다.
검증기 A8은 파일 존재가 아니라 실제 명령 키를 보도록 고쳐 공백 형태를 하드 실패로
잡고, A1은 명령 이름이 다른 skill을 가리는 경우를 새로 막는다.
