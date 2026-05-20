# CLAUDE.md

## 프로젝트 성격 (중요)

`apps-in-toss-community`는 토스/앱인토스 팀과 제휴 관계가 없는 커뮤니티 프로젝트다. 공식 프로젝트 아님. 사용자에게 보여지는 모든 산출물(README, UI 카피, 패키지 설명, 커밋/PR 메시지, 코드 주석 등)에서 "공식(official)", "토스가 제공하는", "powered by Toss" 등 제휴·후원·인증 암시 표현 금지. 대신 "커뮤니티(community)" 같은 자연스러운 표현.

**톤 가이드** (방어적 disclaimer 금지): README 푸터에 한 줄로 1회만 명시 — ko `README.md`는 `커뮤니티 오픈소스 프로젝트입니다.`, en `README.en.md`는 `Community open-source project.`. "제휴 아님" 같은 방어적 표현 대신 "커뮤니티 오픈소스" 정체성만 자연스럽게. 헤더 직후의 `>` blockquote 박스, ⚠️ 아이콘, 굵은 글씨, `unofficial`/`비공식` 같은 강한 라벨은 쓰지 않는다. 한 파일 안에서 영/한 병기 금지(다중 언어는 ko/en 별도 파일로 분리).

**README i18n**: `README.md`(한국어, GitHub default) + `README.en.md`(영어). 둘 다 상단 상호 link(`[한국어](./README.md)` / `[English](./README.en.md)`), 동등 정본 — 한 쪽 갱신 시 같은 PR에서 반대쪽도 갱신. 자세한 정책은 umbrella `CLAUDE.md` "i18n 정책" 섹션.

## 프로젝트 개요

**agent-plugin** — 여러 AI 코딩 에이전트(Claude Code, Codex, Cursor, Windsurf, Gemini 등)에서 앱인토스 미니앱을 생성·개발·테스트·배포할 수 있게 해주는 커뮤니티 플러그인. **최상위 오케스트레이터**로, 다른 repo들이 제공하는 CLI/MCP/문서를 소비해서 하나의 미니앱 개발 워크플로로 엮는다.

이 repo가 직접 소비하는 것은 `console-cli`(CLI 호출), `devtools`(dev-dep + 향후 디버깅 MCP), `polyfill`(템플릿 옵션), `docs`(skill이 path 가리킴), `oidc-bridge`(auth 옵션). Downstream은 `sdk-example` (dog-fooding 타겟).

## 아키텍처 원칙 (중요, repo-specific)

### agent-plugin은 MCP server를 제공하지 않는다

**순수 skills + slash commands 패키지**. 실행 레이어는 다른 repo(console-cli의 CLI, devtools의 MCP 등)가 담당하고, 이 플러그인은 그것들을 **엮는 지식**만 담는다.

플러그인 특성상 **idle context 비용 0**이 압도적으로 중요. MCP tool은 schema가 항상 로드되지만 skill은 호출될 때만 로드된다. CLI를 MCP로 wrapping하면 얻는 가치 없이 context만 낭비.

이 repo에서 MCP는 기본 tool(`Bash`/`Read`/`Write`/`Edit`/`WebFetch`)로 못 하는 일에만 — 예: live 브라우저 상태 조작(devtools 디버깅 MCP), 관리자 전용 운영 데이터(oidc-bridge 관리자 MCP). CLI wrapping·스캐폴딩·문서 fetch는 전부 skill + Bash로.

## 제공물

### Skills (`/ait ...` 명령이 트리거)

| Skill | 책임 | 의존 |
|---|---|---|
| `new-miniapp` | 템플릿 선택·파일 생성·dev-dep 주입 | `Write`/`Edit`, `templates/` |
| `inject-devtools` | 기존 프로젝트에 devtools unplugin 설정 추가 | `Edit` |
| `inject-polyfill` | polyfill 모드로 마이그레이션 | `Edit` |
| `deploy` | 번들 확인 → `ait deploy --api-key` → 결과 해석 + scheme URL 표시 | `Bash`, `@apps-in-toss/cli` |
| `setup-bundle` | 기존 프로젝트에 `.ait` 번들 빌드 환경 추가 (`granite.config.ts` + `bundle:ait` 스크립트) | `Write`/`Edit`, `@apps-in-toss/cli` |
| `register` | `aitcc.yaml` 매니페스트 비대화형 생성 → `aitcc app register` (번들과 배포 사이) | `Write`/`Bash`, console-cli |
| `logs` / `status` | 콘솔 상태 조회 | `Bash`, console-cli |
| `auth-setup` | oidc-bridge 연결 옵션 설정 | `Edit` |
| `setup-phone-preview` | vite.config tunnel 옵션 + dev:phone script + cloudflared 사전 캐시 | `Edit`, `Bash` |
| `docs <topic>` | docs repo에서 주제 경로 리턴, `Read`로 로드 | `Read`/`WebFetch` |
| `debug` | 브라우저 디버깅 안내 (devtools panel · `window.__ait` · 브라우저 DevTools). on-device CDP relay는 진행 중 | `Read`, devtools (optional) |

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

당장은 main branch + latest only, 태그/버전 없음. Changesets는 도입되어 있지만 npm publish는 skip (Git repo 자체가 배포 산출물).

## Status

Scaffold 완료. `shared/{skills,commands,templates}/` + `.claude-plugin/plugin.json` 존재.

- ✅ **작동**: `docs`, `status`, `new-miniapp`, `inject-devtools`, `inject-polyfill`, `auth-setup`, `logs`, `setup-phone-preview`, `deploy`, `setup-bundle`, `register`, `debug`
- 🔜 **확장 예정**: `debug`의 on-device(production 번들) CDP relay 경로 — 브라우저 디버깅은 동작, 폰 안 번들 디버깅은 설계/구현 중
- 📁 **Templates**: `react-vite/` 사용 가능. `react-vite-polyfill/`, `react-vite-supabase/`는 의존 repo 준비 후 추가

## 공통 스택

Node 24 LTS, pnpm 10.33.0, TypeScript strict, Biome (lint+format, ESLint/Prettier 사용 안 함). pre-commit hook은 source-controlled (`.githooks/pre-commit`), contributor가 수동 활성화: `git config core.hooksPath .githooks`. Commit message는 Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`, `refactor:`).

이슈/제안은 GitHub Issues로.
