# templates/

`new-miniapp` skill이 참조할 스캐폴딩 템플릿이 들어갈 디렉토리.

아직 템플릿은 없음 — 구조만 준비.

## 계획

| 템플릿 | 설명 | 의존 |
|---|---|---|
| `react-vite/` | 기본 React + Vite + `@ait-co/devtools` dev-dep | `devtools` 0.1.x npm |
| `react-vite-polyfill/` | 위 + `@ait-co/polyfill` 모드 | `polyfill` |
| `react-vite-supabase/` | 위 + oidc-bridge + Supabase Auth | `oidc-bridge` M1 |

## 원칙

- **단순한 파일 복사 + 변수 치환**으로 동작. 복잡한 템플릿 엔진 도입 금지.
- 변수는 `{{PROJECT_NAME}}` 같은 double-brace 형태로 표시. `new-miniapp`
  skill이 `Edit` tool로 치환.
- 각 템플릿 루트에 `template.json` 메타파일(설명, 필수 변수 목록, post-init
  instructions)을 둔다.

상위 설계는 `../../CLAUDE.md`의 "Templates" 섹션 참고.
