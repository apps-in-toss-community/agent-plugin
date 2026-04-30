# CLAUDE.md

## 프로젝트 성격

비공식(unofficial) 오픈소스 커뮤니티. "공식/official/토스가 제공하는/powered by Toss" 등 제휴·후원·인증 암시 표현 금지. 상세는 umbrella `../CLAUDE.md`의 "프로젝트 성격" 참조.

## 프로젝트 개요

**agent-plugin** — 여러 AI 코딩 에이전트(Claude Code, Codex, Cursor, Windsurf, Gemini 등)에서 앱인토스 미니앱을 생성·개발·테스트·배포할 수 있게 해주는 커뮤니티 플러그인. **최상위 오케스트레이터**로, 다른 repo들이 제공하는 CLI/MCP/문서를 소비해서 하나의 미니앱 개발 워크플로로 엮는다.

짝 repo 전체 그림은 umbrella `../CLAUDE.md`의 "짝(pair) 관계" 참조. 이 repo가 직접 소비하는 것은 `console-cli`(CLI 호출), `devtools`(dev-dep + 향후 디버깅 MCP), `polyfill`(템플릿 옵션), `docs`(skill이 path 가리킴), `oidc-bridge`(auth 옵션). Downstream은 `sdk-example` (dog-fooding 타겟).

## 아키텍처 원칙 (중요, repo-specific)

### agent-plugin은 MCP server를 제공하지 않는다

**순수 skills + slash commands 패키지**. 실행 레이어는 다른 repo(console-cli의 CLI, devtools의 MCP 등)가 담당하고, 이 플러그인은 그것들을 **엮는 지식**만 담는다.

플러그인 특성상 **idle context 비용 0**이 압도적으로 중요. MCP tool은 schema가 항상 로드되지만 skill은 호출될 때만 로드된다. CLI를 MCP로 wrapping하면 얻는 가치 없이 context만 낭비. 일반 MCP 판별 정책은 umbrella `../meta/mcp-strategy.md` 참조.

이 repo에서 MCP는 기본 tool(`Bash`/`Read`/`Write`/`Edit`/`WebFetch`)로 못 하는 일에만 — 예: live 브라우저 상태 조작(devtools 디버깅 MCP), 관리자 전용 운영 데이터(oidc-bridge 관리자 MCP). CLI wrapping·스캐폴딩·문서 fetch는 전부 skill + Bash로.

## 제공물

### Skills (`/ait ...` 명령이 트리거)

| Skill | 책임 | 의존 |
|---|---|---|
| `new-miniapp` | 템플릿 선택·파일 생성·dev-dep 주입 | `Write`/`Edit`, `templates/` |
| `inject-devtools` | 기존 프로젝트에 devtools unplugin 설정 추가 | `Edit` |
| `inject-polyfill` | polyfill 모드로 마이그레이션 | `Edit` |
| `deploy` | 로그인 확인 → `ait-console deploy` → 결과 해석 | `Bash`, console-cli |
| `logs` / `status` | 콘솔 상태 조회 | `Bash`, console-cli |
| `auth-setup` | oidc-bridge 연결 옵션 설정 | `Edit` |
| `docs <topic>` | docs repo에서 주제 경로 리턴, `Read`로 로드 | `Read`/`WebFetch` |
| `debug` | (devtools MCP 있을 때) 브라우저 상태 분석; 없으면 수동 가이드 | devtools MCP (optional) |

### Slash commands & Templates

`commands/ait-*.md`는 얇은 진입점, 실제 절차는 skill이 담는다. `templates/`는 `react-vite/`, `react-vite-polyfill/`, `react-vite-supabase/` (oidc-bridge + Supabase Auth) — `new-miniapp`이 단순 파일 복사 + 변수 치환으로 사용.

## 디렉토리 구조

```
agent-plugin/
├── shared/                      # ✅ source of truth
│   ├── skills/                  # SKILL.md + 하위 리소스
│   ├── commands/                # slash command 진입점
│   └── templates/               # (README만, 실제 템플릿 계획)
├── .claude-plugin/              # ✅ Claude Code plugin manifest (Phase 1)
├── gemini-extension.json        # 🔜 Gemini CLI extension (Phase 2)
├── .codex-plugin/               # 🔜 Codex (Phase 3, 스펙 확정 후)
├── .cursor-plugin/              # 🔜 Cursor (Phase 4)
├── install/                     # 🔜 cursor.sh / windsurf.sh
└── scripts/build.ts             # 🔜 shared/ → 각 타겟 생성
```

`shared/`가 single source of truth. 각 도구별 어댑터 디렉토리는 파일 복사/변환만.

## 배포 phases (repo-specific)

단일 repo에서 지원 도구들 marketplace로 동시 배포 (Figma `mcp-server-guide`의 `.claude-plugin/` + `.cursor-plugin/` 패턴과 유사):

1. **Claude Code** — 공식 plugin manifest, 전 기능 풀스택.
2. **Gemini CLI** — `gemini-extension.json` 매니페스트, skills 네이티브 지원.
3. **Codex** — 스펙이 2026-04 기준 유동적이라 확정 후 착수.
4. **Cursor / Windsurf** — 공식 번들 포맷 부재. `install/*.sh`로 `.cursor/rules/`, `.windsurf/workflows/`에 파일을 꽂는 방식. 자동 업데이트 불가라 후순위.

당장은 main branch + latest only, 태그/버전 없음. 일반 release 정책(Changesets, 버전 권한 등)은 umbrella `../CLAUDE.md` 및 `../meta/release-strategy.md` 참조 (이 repo는 Type B: Changesets 있고 publish skip).

## Status

Scaffold 완료. `shared/{skills,commands,templates}/` + `.claude-plugin/plugin.json` 존재.

- ✅ **작동**: `docs` skill (`/ait docs <topic>` — docs repo에서 주제 페이지 로드, 없으면 graceful fallback)
- 📝 **Stub**: `new-miniapp`, `inject-devtools`, `inject-polyfill`, `deploy`, `logs`, `status`, `auth-setup`, `debug` (placeholder + TODO 마커)
- 📁 **Templates**: 디렉토리만, 실제 템플릿은 의존 repo 준비 후 추가

## 공통 규칙

공통 스택(Node 24 / pnpm 10.33.0 / Biome / pre-commit hook), `gw` 사용법, commit 스타일은 umbrella `../CLAUDE.md` 참조. TODO는 umbrella `../TODO.md`가 single source of truth — 이 repo의 `TODO.md`는 stub.
