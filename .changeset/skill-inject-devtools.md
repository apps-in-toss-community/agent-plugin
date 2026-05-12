---
"@ait-co/agent-plugin": patch
---

feat(skills): implement inject-devtools skill

stub → fully implemented. 기존 Vite/Next.js/Rspack/Webpack 프로젝트에
`@ait-co/devtools` unplugin을 주입하는 절차를 단계별로 기술한다:
빌드 도구 감지, 패키지 매니저 감지, 설치, config 파일 idempotent 패치,
`--mcp` 옵션 지원. `@ait-co/devtools` 0.1.17+ unplugin API 기준.
