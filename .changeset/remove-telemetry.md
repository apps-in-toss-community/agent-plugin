---
'@ait-co/agent-plugin': patch
---

telemetry 코드 전면 제거 — 추후 일관된 단일 설계로 재구현 예정.

- `shared/telemetry.ts`, `telemetry-ping.ts`, `telemetry-state.ts`, `telemetry.test.ts`, `TELEMETRY.md` 삭제
- `shared/commands/ait-*.md` 16개에서 telemetry prelude 호출 배선 제거 (skill 본연 동작은 보존)
- `README.md`/`README.en.md` 텔레메트리 섹션 제거 (ko/en 동시)
- `CHANGELOG.md` telemetry 언급 정리
- `tsconfig.json` 제거, `package.json`의 `typecheck` 스크립트 제거 (TS 소스 없어짐), `test` 스크립트 `--passWithNoTests` 추가
