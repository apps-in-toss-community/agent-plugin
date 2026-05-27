---
"@ait-co/agent-plugin": patch
---

plugin manifest에 `ait-devtools` MCP 서버 등록 — 환경 2·3 단일 MCP surface (#82)

`.claude-plugin/plugin.json`의 `mcpServers`에 `devtools-mcp`(devtools repo 제공 bin)를 `npx -y @ait-co/devtools devtools-mcp`로 등록한다. 머신 절대경로 launcher가 아니라 published bin을 지목하므로 다른 머신 clone에서도 깨지지 않는다. plugin은 MCP를 자체 구현하지 않고 한 줄 등록만 한다(idle context는 attach 전 bootstrap 도구 2종으로 제한).

`debug` skill을 환경 3종 분기로 확장: 환경 1(브라우저)은 기존대로, 환경 2·3(intoss-private candidate / live)은 `build_attach_url` QR로 on-device CDP relay attach 경로를 발급한다. attach 성공 시 `notifications/tools/list_changed`로 attach 의존 도구가 같은 세션에 동적 등록된다.
