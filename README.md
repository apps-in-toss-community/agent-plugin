# agent-plugin

> 🚧 **Work in Progress** — not yet published.
> 아직 개발 중입니다. 릴리스 전입니다.

Community plugin for building [Apps in Toss](https://toss.im/) mini-apps from inside coding agents — supports both **[Claude Code](https://claude.com/claude-code)** and **[OpenAI Codex CLI](https://developers.openai.com/codex)**.

Claude Code 또는 Codex 안에서 앱인토스 미니앱을 **생성·개발·테스트·배포**까지 할 수 있게 해주는 커뮤니티 플러그인.

> This is an **unofficial, community-maintained** project. Not affiliated with or endorsed by Toss or the Apps in Toss team.
> 이 프로젝트는 **비공식 커뮤니티 프로젝트**입니다. 토스/앱인토스 팀과 제휴 관계가 아닙니다.

## Goal / 목표

`@ait-co/devtools`, `sdk-example`, `@ait-co/polyfill`, 커뮤니티 docs를 엮어 하나의 integrated 경험을 제공:

- `/ait new` — 새 미니앱 스캐폴딩
- `/ait devtools` — devtools 패널 / mock 상태 인터랙티브 조작
- `/ait docs <topic>` — 큐레이트된 SDK 문서를 세션에 로드
- `/ait test` — sdk-example 기반 스모크 테스트 실행
- `/ait deploy` — 앱인토스에 배포 (console-cli 호출)

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

## Status

See the [organization landing page](https://apps-in-toss-community.github.io/) for the full roadmap.
