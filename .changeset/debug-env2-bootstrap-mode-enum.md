---
"@ait-co/agent-plugin": patch
---

환경 2 부트스트랩 추가 + `start_debug` mode enum 정정

`/ait debug`가 환경 2(AITC Sandbox PWA) 경로에서 `pnpm dev:phone:cdp`를 직접 백그라운드로
기동하고 `.ait_urls` 준비 완료 신호를 폴링한 뒤 attach로 이어가는 부트스트랩 절차를 추가했다.
`start_debug` mode enum을 데몬 정본(`relay-sandbox`/`relay-staging`/`relay-live`/`local-browser`)으로
정정하고, 환경 2 런타임 swap 제한을 single-connection vs dual-connection 데몬 구분으로 정확하게 서술했다.
