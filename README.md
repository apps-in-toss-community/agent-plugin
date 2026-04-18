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

단일 repo에서 Claude Code와 Codex **양쪽 marketplace로 듀얼 배포**합니다 ([Figma `mcp-server-guide`](https://github.com/figma/mcp-server-guide) 패턴).

```
agent-plugin/
├── shared/                  # source of truth (MCP server, skills, prompts)
├── .claude-plugin/          # Claude Code marketplace manifest
└── .codex-plugin/           # Codex marketplace manifest
```

실제 로직은 MCP server 하나에 모여 있고, 각 에이전트용 slash command는 얇은 래퍼입니다.

### Install

```bash
# Claude Code
/plugin marketplace add apps-in-toss-community/agent-plugin

# OpenAI Codex
codex marketplace add apps-in-toss-community/agent-plugin
```

## Status

See the [organization landing page](https://apps-in-toss-community.github.io/) for the full roadmap.
