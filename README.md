# agent-plugin

> 🚧 **Work in Progress** — not yet published.
> 아직 개발 중입니다. 릴리스 전입니다.

Community plugin for building [Apps in Toss](https://toss.im/) mini-apps from inside coding agents — supports both **[Claude Code](https://claude.com/claude-code)** and **[OpenAI Codex CLI](https://developers.openai.com/codex)**.

Claude Code 또는 Codex 안에서 앱인토스 미니앱을 **생성·개발·테스트·배포**까지 할 수 있게 해주는 커뮤니티 플러그인.

> This is an **unofficial, community-maintained** project. Not affiliated with or endorsed by Toss or the Apps in Toss team.
> 이 프로젝트는 **비공식 커뮤니티 프로젝트**입니다. 토스/앱인토스 팀과 제휴 관계가 아닙니다.

## Goal / 목표

`@ait-co/devtools`, `sdk-example`, `@ait-co/polyfill`, 커뮤니티 docs를 엮어 하나의 integrated 경험을 제공합니다. 현재 scaffold된 slash command(일부는 stub):

- `/ait new` — 새 미니앱 스캐폴딩 _(stub)_
- `/ait docs <topic>` — 큐레이트된 SDK 문서를 세션에 로드 _(working — docs repo 콘텐츠는 작성 중)_
- `/ait inject-devtools` / `/ait inject-polyfill` — 기존 프로젝트에 설정 주입 _(stub)_
- `/ait debug` — 브라우저 상태 분석 (devtools MCP 있을 때) _(stub)_
- `/ait deploy` / `/ait logs` / `/ait status` — console-cli 기반 운영 _(stub)_
- `/ait auth-setup` — oidc-bridge 연결 구성 _(stub)_

전체 skill 목록과 의존 repo는 [`CLAUDE.md`](./CLAUDE.md)의 "Skills" 표 참고.

## Distribution / 배포 구조

단일 repo에서 여러 AI 코딩 에이전트 marketplace로 **듀얼 배포**합니다 ([Figma `mcp-server-guide`](https://github.com/figma/mcp-server-guide) 패턴).

```
agent-plugin/
├── shared/                  # source of truth (skills, commands, templates)
│   ├── skills/              # SKILL.md 번들
│   ├── commands/            # slash command 진입점 (얇은 래퍼)
│   └── templates/           # 스캐폴딩 템플릿
├── .claude-plugin/          # Claude Code plugin manifest (Phase 1, 현재)
└── .codex-plugin/           # Codex (Phase 3, 스펙 확정 후)
```

`shared/`가 source of truth입니다. 실로직은 skill에 담고, slash command는 얇은 래퍼. 아키텍처·의사결정 배경은 [`CLAUDE.md`](./CLAUDE.md) 참고.

### Install

```bash
# Claude Code (Phase 1 — manifest 존재, marketplace 등록은 아직)
/plugin marketplace add apps-in-toss-community/agent-plugin
```

Codex / Gemini CLI / Cursor / Windsurf는 Phase 2+ 예정입니다. [`CLAUDE.md`](./CLAUDE.md)의 "배포 전략" 참고.

## Development / 개발 환경

### Pre-commit hook

Optional but recommended. After cloning, activate the standard pre-commit hook (runs `biome check` on staged files):

```sh
git config core.hooksPath .githooks
```

This is a developer convenience for fast feedback before push. CI runs the same checks as the enforcement layer, so contributors who don't activate the hook will still see lint failures in their PR.

clone 후 위 한 줄을 실행하면 staged 파일에 `biome check`이 자동으로 돌아 push 전에 lint 문제를 잡아줍니다. 활성화는 선택이지만 권장합니다 — 활성화하지 않아도 CI에서 동일한 검사가 enforcement layer로 동작합니다.

## Status

See the [organization landing page](https://apps-in-toss-community.github.io/) for the full roadmap.
