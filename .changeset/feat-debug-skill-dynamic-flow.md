---
"@ait-co/agent-plugin": patch
---

/ait debug SKILL.md: on-device relay 동적 흐름 안내로 확장 (#81)

`shared/skills/debug/SKILL.md` §5를 동적 attach 흐름 실행 안내로 확장한다. `MCP_ENV` 환경 자동 감지 설명(`mock`/`relay-dev`/`relay-live`), `ait build && ait deploy --scheme-only` candidate 번들 준비 단계(5-B), `build_attach_url` QR 발급 → 스캔 → attach 확인(5-C/5-D), attach 후 자동 등록되는 9종 도구 명세, bootstrap 3종 목록 업데이트, 관측 결과 분기 seam 확장, docs deep-link를 주제 페이지로 교체.
