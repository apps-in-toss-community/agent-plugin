---
'@ait-co/agent-plugin': patch
---

harness 유저 시나리오 seam 끊김 5건 정리 — zero→ship 흐름이 각 station에서 다음 station을 in-flow로 가리키도록 보강:

- `new-miniapp` 다음-단계에 `/ait auth-setup` 추가 + `auth-setup`에 bridge client_id/Supabase provider 사전 조건 안내 단계(2.5) 신설 (코드 생성 전 외부 발급 경로를 인쇄)
- `register`의 `/ait design` "미착수" 오기 정정(실제 구현됨) + 이미지 에러 실패 표에 `/ait design` cross-ref, `setup-bundle` 다음-단계에 design 추가
- `ait-setup-bundle` 명령 description 파일명 오기(`apps-in-toss.config.ts` → `granite.config.ts`)
- `status` 분기 표에 `serviceStatus: PREPARE`(검수 미제출) 행 추가 → `/ait debug` 환경 3 dog-food로 라우팅
- 신규 `/ait welcome` skill — `/plugin install` 직후 station map + `/ait new`를 인쇄하는 station 0→1 hand-off
