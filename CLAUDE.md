# CLAUDE.md

## 프로젝트 성격 (중요)

**`apps-in-toss-community`는 비공식(unofficial) 오픈소스 커뮤니티다.** 토스 팀과 제휴 없음. 사용자에게 보이는 산출물에서 "공식/official/토스가 제공하는/powered by Toss" 등 제휴·후원·인증 암시 표현을 **쓰지 않는다**. 대신 "커뮤니티/오픈소스/비공식"을 사용한다. 의심스러우면 빼라.

## 짝 repo

이 플러그인은 **최상위 오케스트레이터**다. 다른 repo들이 제공하는 CLI/MCP/문서를 **소비**해서 하나의 미니앱 개발 워크플로로 엮는다.

### Consume하는 것

| 짝 repo | 제공 형태 | agent-plugin이 쓰는 방식 |
|---|---|---|
| `devtools` | (1) npm 패키지 dev dependency, (2) **향후 디버깅 MCP** | `/ait new`가 템플릿에 dev-dep으로 주입. MCP가 나오면 `/ait debug` skill이 활용 |
| `polyfill` | npm 패키지 | `/ait new` 시 "표준 Web API 모드" 옵션으로 선택 주입 |
| `docs` | 문서 repo | `/ait docs <topic>` skill이 path를 가리켜 에이전트가 `Read`/`WebFetch`로 로드 |
| `console-cli` | `ait-console` CLI 바이너리 | `/ait deploy`, `/ait logs` 등 skill이 `Bash(ait-console ...)`로 호출 |
| `oidc-bridge` | HTTP 엔드포인트 (+ 향후 관리자 MCP) | `/ait new`에서 Supabase/Firebase 옵션 선택 시 템플릿에 설정 주입 |

### Downstream

- **`sdk-example`** (downstream consumer / dog-fooding 타겟) — agent-plugin이 완성되면 sdk-example **자체의 유지보수**(새 API 추가, 스크린샷 갱신 등)를 `/ait` 명령으로 수행. "플러그인이 실제 repo를 유지보수할 수 있는가"가 성숙도 기준.

## 프로젝트 개요

**agent-plugin** — 여러 AI 코딩 에이전트(Claude Code, Codex, Cursor, Windsurf, Gemini 등)에서 앱인토스 미니앱을 생성·개발·테스트·배포할 수 있게 해주는 커뮤니티 플러그인.

## 아키텍처 원칙 (중요)

### agent-plugin은 MCP server를 제공하지 않는다

**순수 skills + slash commands 패키지**. 실행 레이어는 다른 repo(console-cli의 CLI, devtools의 MCP 등)가 담당하고, 이 플러그인은 그것들을 **엮는 지식**만 담는다.

### 왜 MCP를 내부에 두지 않는가

| | MCP tool | Skill / Slash command |
|---|---|---|
| Idle context 비용 | 🔴 **항상 로드** (tool schema 상주) | 🟢 0 — 호출될 때만 |
| 호출 시 context | 낮음 | 중간 (필요한 가이드만) |
| 설치 복잡도 | 런타임 프로세스 필요 | 마크다운 파일 복사만 |
| 크로스 에이전트 이식 | 도구별 설정 포맷 분기 (JSON/TOML) | 파일 복사/변환 |
| 디버깅 투명성 | 래퍼 안에서 숨어 일어남 | tool use 로그에 전부 남음 |

플러그인 특성상 **idle 비용 0**이 압도적으로 중요. MCP로 CLI를 감싸면 얻는 가치 없이 context만 낭비.

### MCP가 필요한 경우 vs 아닌 경우

Repo별로 판단:

- ✅ **MCP 필요** — 에이전트 기본 tool(`Bash`/`Read`/`Write`/`Edit`/`WebFetch`)로 **할 수 없는 일**:
  - live 브라우저 상태 조작 (devtools 디버깅 MCP)
  - 관리자 전용 운영 데이터 접근 (oidc-bridge 관리자 MCP — 공용 MCP 금지)
- ❌ **MCP 불필요** — Bash로 가능한 것은 전부 skill + CLI로:
  - CLI wrapping (console-cli)
  - 파일 생성/수정 (스캐폴딩)
  - 문서 fetch

전체 정책 매트릭스는 **umbrella `../CLAUDE.md`의 "MCP 전략" 섹션**에서 관리 (모든 repo가 이 기준을 공유).

## 제공물

### Skills

사용자 명령(`/ait ...`)이 트리거하면 로드되는 **절차/지식 번들**.

| Skill | 책임 | 의존 |
|---|---|---|
| `new-miniapp` | 템플릿 선택·파일 생성·dev-dep 주입 | `Write`/`Edit` tool, `templates/` |
| `inject-devtools` | 기존 프로젝트에 devtools unplugin 설정 추가 | `Edit` |
| `inject-polyfill` | polyfill 모드로 마이그레이션 | `Edit` |
| `deploy` | 로그인 확인 → `ait-console deploy` 실행 → 결과 해석 | `Bash`, console-cli 바이너리 |
| `logs` / `status` | 콘솔 상태 조회 | `Bash`, console-cli |
| `auth-setup` | oidc-bridge 연결 옵션 설정 | `Edit` |
| `docs <topic>` | docs repo에서 해당 주제 경로 리턴, `Read`로 로드 | `Read`/`WebFetch` |
| `debug` | (devtools MCP가 있을 때) 브라우저 상태 분석; 없으면 수동 가이드 | devtools MCP (optional) |

### Slash commands

```
commands/
├── ait-new.md          → new-miniapp skill 로드
├── ait-deploy.md       → deploy skill 로드
├── ait-debug.md        → debug skill 로드
├── ait-docs.md         → docs skill + topic 인자
└── ...
```

각 command는 **얇은 진입점**. 실제 절차는 skill이 담는다.

### Templates

```
templates/
├── react-vite/              # 기본 템플릿
├── react-vite-polyfill/     # polyfill 모드
└── react-vite-supabase/     # oidc-bridge + Supabase Auth
```

`new-miniapp` skill이 참조. 단순 파일 복사 + 변수 치환으로 동작.

## 디렉토리 구조 (계획 전체 — 현재 일부만 존재)

```
agent-plugin/
├── shared/                      # ✅ 존재
│   ├── skills/                  # ✅ SKILL.md + 하위 리소스
│   ├── commands/                # ✅ slash command 진입점
│   └── templates/               # ✅ (README만, 실제 템플릿은 계획)
│
├── .claude-plugin/              # ✅ Claude Code plugin manifest (Phase 1)
├── gemini-extension.json        # 🔜 Gemini CLI extension (Phase 2)
├── .codex-plugin/               # 🔜 Codex (Phase 3, 스펙 확정 후)
├── .cursor-plugin/              # 🔜 Cursor (Phase 4, 번들 포맷 정해지면)
│
├── install/                     # 🔜 공식 번들 매니페스트 없는 도구용 (Phase 4)
│   ├── cursor.sh
│   └── windsurf.sh
│
└── scripts/build.ts             # 🔜 shared/ → 각 타겟 생성 (필요 시점에)
```

✅ = 존재, 🔜 = 계획. `shared/`가 source of truth. 각 도구별 어댑터
디렉토리는 파일명/경로만 다름. 현재 상태는 아래 "Status" 섹션 참고.

## 배포 전략

**단일 repo에서 지원 도구들 marketplace로 동시 배포** ([Figma `mcp-server-guide`](https://github.com/figma/mcp-server-guide)의 `.claude-plugin/` + `.cursor-plugin/` 패턴과 유사).

### MVP 타겟 우선순위

1. **Claude Code** (Phase 1) — 공식 plugin manifest + skill/command 생태계 가장 성숙. 전 기능 풀스택 사용.
2. **Gemini CLI** (Phase 2) — extension manifest(`gemini-extension.json`)가 성숙. skills 네이티브 지원.
3. **Codex** (Phase 3) — plugin/marketplace 스펙이 2026-04 기준 유동적이라 **확정 후 착수**.
4. **Cursor / Windsurf** (Phase 4) — 공식 번들 포맷 부재. `install/*.sh`로 `.cursor/rules/`, `.windsurf/workflows/` 파일을 사용자 설정에 꽂는 방식. 자동 업데이트 불가라 후순위.

모든 단계에서 **`shared/`는 하나**. 도구별 디렉토리는 생성/복사만.

## Release 전략

**당장은 main branch + latest only**. 태그/버전 없음. 사용자는 각 marketplace의 최신 main을 바라봄.

## Status

Scaffold 완료. `shared/{skills,commands,templates}/` + `.claude-plugin/plugin.json` 존재.

- ✅ **작동하는 skill**: `docs` (`/ait docs <topic>` — docs repo에서 주제 페이지 로드, 없으면 graceful fallback)
- 📝 **Stub skill** (placeholder만, TODO 마커로 의존 repo 표시): `new-miniapp`, `inject-devtools`, `inject-polyfill`, `deploy`, `logs`, `status`, `auth-setup`, `debug`
- 📁 **Templates**: 디렉토리 생성됨, 실제 템플릿은 의존 repo(devtools/polyfill/oidc-bridge) 준비 후 추가

다음 단계는 `TODO.md`의 Medium Priority 참고. 전체 로드맵은 [landing page](https://apps-in-toss-community.github.io/), 짝 repo 관계는 상위 `../CLAUDE.md`(umbrella)의 "의존성 지도" 참고.
