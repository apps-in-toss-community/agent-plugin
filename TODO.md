# TODO

## High Priority
- [ ] Scaffold dual structure — `shared/{skills,commands,templates}/` + `.claude-plugin/` manifest. Prove the layout with one end-to-end skill (suggest: `docs <topic>` — lowest dependency, only needs `Read`/`WebFetch`).

## Medium Priority
- [ ] `new-miniapp` skill + 기본 React+Vite 템플릿 (`templates/react-vite/`) — devtools dev-dep 주입 포함. Requires devtools 0.1.x on npm.
- [ ] `deploy` skill — `ait-console deploy` wrapping. Requires console-cli `login`+`deploy` 구현 완료.
- [ ] `docs <topic>` skill — docs repo 경로 리졸버 + `Read`/`WebFetch` 안내. docs 콘텐츠가 의미 있게 채워진 뒤 우선순위 상승.
- [ ] Claude Code plugin manifest (`.claude-plugin/plugin.json`) + marketplace 등록

## Low Priority
- [ ] Gemini CLI extension (`gemini-extension.json`) — Phase 2 타겟
- [ ] `inject-devtools` skill — 기존 프로젝트에 unplugin 설정 추가
- [ ] `inject-polyfill` skill — polyfill 모드로 마이그레이션
- [ ] `auth-setup` skill — oidc-bridge 연결 옵션 설정. oidc-bridge가 M1 이상 완성된 후.
- [ ] `logs` / `status` skill — console-cli 대응 명령 wrap

## Performance
(None)

## Backlog
- [ ] Codex plugin scaffold — plugin/marketplace 스펙이 2026-04 기준 유동적. 스펙 확정 후 착수.
- [ ] Cursor / Windsurf install.sh — 공식 번들 포맷 없음. 자동 업데이트 불가하므로 후순위.
- [ ] `debug` skill — devtools MCP 기반 브라우저 상태 분석. devtools MCP 출시 후.
- [ ] `shared/` → 각 도구별 디렉토리 빌드 스크립트 (`scripts/build.ts`)
