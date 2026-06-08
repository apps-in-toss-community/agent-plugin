---
'@ait-co/agent-plugin': patch
---

`debug` skill의 환경 2(relay-sandbox) single/dual-connection 데몬 분기 안내 정정 — 이 분기는 사용자가 만나지 않는 허구였다.

devtools 소스 확인 결과 프로덕션 MCP bin 3개(`runDebugServer`/`runLocalDebugServer`/`runMobileDebugServer`)는 전부 `DualConnectionRouter`를 사용하므로, single-connection 데몬의 `relay-sandbox` 거부 에러는 테스트에서만 도달한다. plugin이 등록한 기본 데몬(`npx -y @ait-co/devtools devtools-mcp`)에서 `start_debug({mode:'relay-sandbox'})`는 재구동 없이 in-place 진입한다 — 진짜 전제는 외부 relay 주소(`AIT_RELAY_BASE_URL` 또는 `.ait_urls` 자동 발견)뿐이며, 이는 env-2가 unplugin이 띄운 외부 relay에 붙는 아키텍처 상수에서 온다. "데몬 재시작" 안내를 relay 주소 배선 안내(`/ait setup-phone-preview`)로 교체.
