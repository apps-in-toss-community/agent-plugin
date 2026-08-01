# agent-plugin

**한국어** · [English](./README.en.md)

AI 코딩 에이전트 안에서 앱인토스 미니앱을 생성·개발·테스트·배포까지 할 수 있게 해주는 커뮤니티 플러그인입니다. 현재 [Claude Code](https://claude.com/claude-code)를 지원하며, Codex 등 다른 에이전트는 후속 Phase에서 추가됩니다.

이 프로젝트는 더 이상 유지보수되지 않습니다. repo는 archive되어 read-only가 되며, 소스와 이슈 기록은 GitHub에 그대로 남습니다. 이 플러그인은 npm 패키지가 아니라 Git repo 자체가 배포 산출물이므로 archive 후에도 `/plugin marketplace add apps-in-toss-community/agent-plugin`으로 설치할 수 있지만, 더 이상 업데이트되지 않습니다. `aitc.dev` 도메인과 그 위에서 서비스하던 사이트도 함께 종료되므로, 문서 링크는 GitHub 소스를 가리키도록 바꿨습니다 — skill이 인쇄하는 커뮤니티 docs 링크는 이제 [`apps-in-toss-community/docs`](https://github.com/apps-in-toss-community/docs)의 소스 파일입니다.

이 repo에서 그 도메인에 의존하던 부분은 두 곳입니다. `/ait:setup-phone-preview`·`/ait:debug`가 안내하는 환경 2(실기기 PWA 미리보기)는 진입점인 launcher PWA가 `https://devtools.aitc.dev/launcher/`에 배포돼 있고 터널 QR / deep-link도 그 주소로 만들어지는데, 대체 호스트가 없습니다. `/ait:auth-setup`이 기본값으로 삼던 공용 oidc-bridge 인스턴스(`oidc-bridge.aitc.dev`)도 함께 내려가며, 남는 경로는 [`oidc-bridge`](https://github.com/apps-in-toss-community/oidc-bridge) 소스를 직접 호스팅하는 self-host입니다. 이미 폰에 설치된 launcher에는 이 사실을 소급 적용할 수 없습니다.

## 목표

`@ait-co/devtools`, `sdk-example`, `@ait-co/polyfill`, 커뮤니티 docs를 엮어 하나의 통합된 경험을 제공합니다. 현재 제공하는 slash command:

- `/ait:new` — 새 미니앱 스캐폴딩
- `/ait:docs <topic>` — 큐레이트된 SDK 문서를 세션에 로드
- `/ait:inject-devtools` / `/ait:inject-polyfill` / `/ait:inject-debug-console` — 기존 프로젝트에 설정 주입
- `/ait:status` / `/ait:logs` — console-cli 기반 상태 조회
- `/ait:auth-setup` — oidc-bridge 연결 구성
- `/ait:debug` — 브라우저 디버깅 안내 (devtools 패널 · `window.__ait` · 브라우저 DevTools). 폰 안 번들의 on-device CDP 디버깅은 진행 중
- `/ait:deploy` — 미니앱 배포

전체 skill 목록과 의존 repo는 [`CLAUDE.md`](./CLAUDE.md)의 "Skills" 표 참고.

## 배포 구조

단일 repo에서 여러 AI 코딩 에이전트 marketplace로 **듀얼 배포**합니다 ([Figma `mcp-server-guide`](https://github.com/figma/mcp-server-guide) 패턴).

```
agent-plugin/
├── shared/                  # source of truth (skills, commands, templates)
│   ├── skills/              # SKILL.md 번들
│   ├── commands/            # slash command 진입점 (얇은 래퍼)
│   └── templates/           # 스캐폴딩 템플릿
├── .claude-plugin/          # Claude Code plugin + marketplace manifest (Phase 1, 현재)
└── .codex-plugin/           # Codex (Phase 3, 스펙 확정 후)
```

`shared/`가 source of truth입니다. 실로직은 skill에 담고, slash command는 얇은 래퍼. 아키텍처·의사결정 배경은 [`CLAUDE.md`](./CLAUDE.md) 참고.

### 설치

Claude Code에서 marketplace를 추가하고 플러그인을 설치합니다:

```bash
/plugin marketplace add apps-in-toss-community/agent-plugin
/plugin install ait@aitc
```

설치 후 `/ait:` 명령(`/ait:new`, `/ait:deploy` 등)을 사용할 수 있습니다. 플러그인 이름이 네임스페이스라 콜론 형태가 실제 명령이고, 공백 형태(`/ait new`)는 존재하지 않습니다.

Codex / Gemini CLI / Cursor / Windsurf는 Phase 2+ 예정입니다. [`CLAUDE.md`](./CLAUDE.md)의 "배포 phases" 참고.

## 개발 환경

### Pre-commit hook

선택 사항이지만 권장합니다. clone 후 표준 pre-commit hook을 활성화하면 staged 파일에 `biome check`이 자동으로 돌아 push 전에 lint 문제를 잡아줍니다:

```sh
git config core.hooksPath .githooks
```

활성화하지 않아도 CI에서 동일한 검사가 enforcement layer로 동작하므로, hook을 활성화하지 않은 contributor도 PR 단계에서 lint 실패를 볼 수 있습니다.

## 현황

관련 repo는 [조직 GitHub](https://github.com/apps-in-toss-community)에서 볼 수 있습니다.

---

커뮤니티 오픈소스 프로젝트입니다.
