---
"@ait-co/agent-plugin": patch
---

환경 2(AITC Sandbox PWA) CDP 터널 seam 배선

setup-phone-preview skill의 tunnel 주입 형태를 sdk-example/vite.config.ts 정본에
맞게 교정(`tunnel: process.env.AIT_TUNNEL ? { cdp: !!process.env.AIT_TUNNEL_CDP } : false`)하고,
CDP relay용 `dev:phone:cdp` 스크립트를 추가했다.
debug skill의 환경 2 진입 전제를 구체화해 `pnpm dev:phone:cdp`가 CDP relay
(`AIT_RELAY_BASE_URL`/`AIT_TUNNEL_BASE_URL`)를 boot한다는 점과 `dev:phone`(screen-only)과의
차이를 명시함으로써 `/ait setup-phone-preview` → `/ait debug`(환경 2) seam 절벽을 제거했다.
