---
"@ait-co/agent-plugin": patch
---

react-vite 템플릿과 관련 skills를 web-framework stable 2.x 기준선으로 되돌림.

scaffold 기준선은 항상 stable(web-framework 2.x, devtools `latest`)이어야 하며, 3.0-beta는 GA flip 부분 선행 staging일 뿐 개발 base가 아니다.

변경 내용:
- `shared/templates/react-vite/package.json`: `@apps-in-toss/web-framework` `3.0.0-beta.9d42c0b` → `^2.6.0`, `build` 스크립트에서 `&& ait build` 제거
- `shared/templates/react-vite/vite.config.ts`: `optimizeDeps.exclude`에서 `@apps-in-toss/webview-bridge` 제거, `@apps-in-toss/web-bridge`·`@apps-in-toss/web-analytics` 복구
- `shared/skills/setup-bundle/SKILL.md`: `granite.config.ts` + `@apps-in-toss/cli` 설치 단계 + `outdir`/`web{}` 블록 포함 2.x 스키마 복구
- `shared/skills/deploy/SKILL.md`: `ait deploy --profile` + `--scheme-only` 플로 복구
- `shared/skills/deploy-key/SKILL.md`: `ait deploy --profile` 기반 배포 명령 복구
- `shared/skills/debug/SKILL.md`: 환경 3 후보 빌드·배포 설명 2.x(`ait deploy --scheme-only`) 복구 (c593c71의 환경 2 MCP-attach 변경은 유지)
- `shared/skills/new-miniapp/SKILL.md`, `plan/SKILL.md`, `register/SKILL.md`: 번들러 참조 복구
