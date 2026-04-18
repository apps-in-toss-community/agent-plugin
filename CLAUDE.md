# CLAUDE.md

## 프로젝트 성격 (중요)

**`apps-in-toss-community`는 비공식(unofficial) 오픈소스 커뮤니티다.** 토스 팀과 제휴 없음. 사용자에게 보이는 산출물에서 "공식/official/토스가 제공하는/powered by Toss" 등 제휴·후원·인증 암시 표현을 **쓰지 않는다**. 대신 "커뮤니티/오픈소스/비공식"을 사용한다. 의심스러우면 빼라.

## 짝 repo

이 플러그인은 **최상위 오케스트레이터**다. 거의 모든 다른 repo와 짝 관계를 가진다.

- **`devtools`** — `/ait new`가 스캐폴딩하는 미니앱 템플릿의 dev 의존성.
- **`polyfill`** — (선택) `/ait new` 시 표준 Web API 모드로 스캐폴딩할 때 주입.
- **`docs`** — `/ait docs <topic>`이 세션에 로드하는 문서 소스.
- **`sdk-example`** — `/ait docs`가 각 SDK 주제에서 live code로 deep-link.
- **`console-cli`** — `/ait deploy`가 내부적으로 호출.
- **`oidc-bridge`** — `/ait new`에서 Supabase/Firebase 옵션 선택 시 연결.

## 프로젝트 개요

**agent-plugin** — Claude Code와 OpenAI Codex CLI **양쪽에서 동작하는** 커뮤니티 플러그인. 앱인토스 미니앱을 생성·개발·테스트·배포한다.

### 배포 전략

**단일 repo에서 두 marketplace로 듀얼 배포** ([Figma `mcp-server-guide`](https://github.com/figma/mcp-server-guide) 패턴).

```
agent-plugin/
├── shared/                  # source of truth
│   ├── mcp-servers/         # 실제 로직 (핵심)
│   ├── skills/
│   └── prompts/
├── .claude-plugin/          # Claude Code marketplace manifest
│   └── marketplace.json
└── .codex-plugin/           # Codex marketplace manifest
    └── plugin.json
```

**핵심 원칙**: 실제 로직은 `shared/mcp-servers/`의 MCP server 하나에 모은다. 양쪽의 slash command(`/ait new` 등)는 "이 MCP tool을 호출해줘" 수준의 얇은 래퍼.

### Marketplace별 차이점

| | Claude Code | Codex |
|---|---|---|
| Manifest | `.claude-plugin/marketplace.json` | `.codex-plugin/plugin.json` |
| MCP 설정 | `.mcp.json` (JSON) | `config.toml` 테이블 (글로벌) / `.mcp.json` (plugin 내) |
| Slash command | `commands/*.md` | `prompts/*.md` (deprecated, skills로 이전 중) |
| Hook 번들 가능? | Yes | 글로벌만, plugin 번들 미지원 |
| Subagent 번들 가능? | Yes | 공식 미지원 |

→ 두 agent 간 **공통 feature만** plugin으로 번들, 차이나는 부분은 각 manifest에서 분기.

## Release 전략

**당장은 main branch + latest only**. 태그/버전 없음. 사용자는 각 marketplace의 최신 main을 바라봄.

## Status

placeholder 상태. 구조 scaffolding부터 시작.

전체 로드맵은 [landing page](https://apps-in-toss-community.github.io/) 참고. 짝 repo 관계는 상위 `../CLAUDE.md`(umbrella)의 "의존성 지도" 참고.
