---
"@ait-co/agent-plugin": patch
---

docs(skills/debug): `start_debug(mode)` 단일 진입 경로로 SKILL.md 갱신

`MCP_ENV` 기반 서버 재구동 방식을 deprecated로 표시하고, 환경 전환의 정본 경로를
`start_debug({mode})` 런타임 호출로 전환. mode 표(`local-browser-dev` / `local-browser-cdp`
/ `relay-dev` / `relay-live`), `relay-live`의 `confirm:true` 2중 게이트, attach 흐름의
`start_debug` → `build_attach_url` 2단계를 명확히 기술. devtools #348/#356/#358 정합.
