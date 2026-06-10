---
name: status
description: |
  Show Apps in Toss console state for the current workspace and mini-app(s)
  via the community `aitcc` CLI. User invokes `/ait status`. Reports
  authenticated user/workspace, mini-apps in the workspace, and (when an
  `aitcc.yaml` is present in cwd) the review state of the current app.
  Triggered by `/ait status`. Read-only — does not modify any console state.
argument-hint: ''
---

# status skill

## 목적

`/ait status` 한 번으로 사용자가 묻기 전에 답해야 하는 것:

- 누가 로그인되어 있는가? (계정 + workspace)
- 이 workspace에 등록된 미니앱이 있는가?
- (cwd에 `aitcc.yaml`이 있으면) **이 프로젝트**의 미니앱은 지금 console에서
  어떤 상태인가? (review, rejected, approved)

이 skill은 [`@ait-co/console-cli`](https://github.com/apps-in-toss-community/console-cli)
의 `aitcc` CLI를 Bash로 호출만 한다 — 자체 API 호출 없음.

## 의존

- `aitcc` CLI가 PATH에 있어야 함 (npm: `@ait-co/console-cli`).
  - 없으면 graceful fallback (아래 "CLI 미설치" 참고).
- 사용자가 한 번 이상 `aitcc login` 해서 세션이 캐시되어 있어야 함.
  - 미인증이면 `aitcc whoami`가 비워진 상태로 응답 — 그것도 status의 답이다.

이 skill은 read-only다. login/logout/deploy/register 같은 변경 명령을 부르지 않는다 (그건 다른 skill의 책임).

## 실행 순서

### 1. CLI 가용성 확인

```bash
command -v aitcc
```

없으면 "CLI 미설치" fallback으로 분기.

### 2. 인증 + workspace 확인

```bash
aitcc whoami --json
```

JSON shape는 console-cli가 제공한다. 핵심 필드만 사용자에게 보여준다 —
이메일, workspaceId, workspaceName 등 (정확한 키는 호출 시 응답을 보고
취사). 미인증이면 stdout이 비거나 에러로 나온다 — 그 상태를 그대로 알리고
`aitcc login` 안내.

### 3. Workspace의 미니앱 목록

```bash
aitcc app ls --json
```

목록을 사용자에게 보여준다 (id, 이름, 마지막 상태 정도면 충분 — 다 펼치지
말 것). 항목이 없으면 "이 workspace에 미니앱이 없습니다" + `aitcc app
register` 안내.

### 4. 현재 프로젝트의 앱 상태 (있으면)

cwd에 `aitcc.yaml` 또는 `aitcc/aitcc.yaml`이 있으면 다음을 호출한다.
**`aitcc app status` / `service-status`는 ID 인자가 optional**이며, 같은
디렉토리의 `aitcc.yaml`에서 `miniAppId`를 자동으로 읽는다 — 별도 YAML
파싱 불필요:

```bash
aitcc app status --json
aitcc app service-status --json
```

두 결과를 묶어서 보여준다:

- **review state** (`under-review` / `rejected` / `approved`) — `app status`
- **runtime state** (`serviceStatus`, shutdown 일정) — `app service-status`

`aitcc.yaml`이 없으면 이 step은 skip하고, "이 디렉토리는 등록된 미니앱이
아닙니다 — `/ait register`로 시작하세요"로 끝낸다.

> `aitcc.yaml` 위치 탐색은 CLI에 위임한다 (cwd 기준). parent 디렉토리를
> 거슬러 올라갈지 여부도 CLI가 결정 — skill에서 별도 로직 없음.

### 5. 요약 + 다음 단계 (관측 결과로 분기)

마지막에 한 줄 요약 + **관측된 상태에 따라 다음 `/ait` 명령을 분기 제시**한다. status는 read-only지만 seam은 가진다 — "지금 상태면 다음은 무엇"을 직접 인쇄한다.

요약 한 줄 (bullet 두 줄을 넘기지 않는다 — 자세한 건 위에서 이미 보여줬다):

```
you@example.com / workspace <번호> <이름> · 앱 N개 ·
현재 프로젝트 <앱 이름> (id <miniAppId>): under-review
```

이어서 상태별 다음 단계:

| 관측된 상태 | 다음 단계 |
|---|---|
| 미인증 (`whoami` 비어 있음) | `aitcc login` (첫 1회만 브라우저) |
| cwd에 `aitcc.yaml` 없음 (미등록) | `/ait register`로 콘솔 등록 |
| 등록됨 · `serviceStatus: PREPARE` (검수 미제출) | 배포된 번들은 있으나 아직 검수를 제출하지 않은 상태(`ait deploy --scheme-only` 직후). 실기기 dog-food는 `/ait debug`(환경 3 — QR/deep-link relay 주입으로 PREPARE에서도 cold-load). 검수 제출 준비가 됐으면 `aitcc app deploy <path-to-bundle.ait> --request-review`(비가역, path는 `ait build`가 출력하는 .ait 경로). |
| 등록됨 · `under-review` | 운영팀 처리 대기. 그 사이 실기기 dog-food는 `/ait debug`(환경 3 — QR/deep-link relay 주입으로 PREPARE에서도 cold-load) |
| 등록됨 · `rejected` | 반려 사유 확인 후 수정 → `/ait deploy`로 재업로드 |
| 등록됨 · `approved` / `OPENED` | `/ait deploy`로 새 번들 배포 |

이 skill은 분기 명령을 **자동 실행하지 않는다** — 가리키기만 한다.

## CLI 미설치 fallback

`aitcc`가 없으면:

```
console 상태를 확인하려면 `@ait-co/console-cli`가 필요합니다 (현재 PATH에 없음).

설치:
  npm i -g @ait-co/console-cli       # 또는 pnpm/bun
  aitcc login                          # 첫 1회만 브라우저, 이후 headless

설치 후 다시 `/ait status`를 호출해주세요.

참고: https://github.com/apps-in-toss-community/console-cli
```

`aitcc`는 있는데 미인증인 경우는 그냥 `aitcc whoami` 결과를 그대로 보여주고
`aitcc login` 안내만 덧붙인다 — 별도 큰 fallback 블록 안 만든다.

## 하지 말아야 할 것

- ❌ `aitcc login` / `logout` / `deploy` / `register`를 자동 호출. 이 skill은
  read-only.
- ❌ `aitcc.yaml`을 자동 생성하거나 수정. (그건 `new-miniapp` 또는
  `/ait register` 책임)
- ❌ JSON 응답을 통째로 덤프. 핵심 필드만 추려서 보여준다.
- ❌ 응답에서 access token, cookie, session blob 등 민감 정보를 그대로
  화면에 보여주기. `aitcc whoami`는 기본적으로 redact 되어 있지만, 출력에
  의심스러운 string이 있으면 `[redacted]`로 가린다.

## 참고

- console-cli 명령 레퍼런스: https://github.com/apps-in-toss-community/console-cli
- 짝 skill: `deploy` (이 skill이 안전하다고 알려준 뒤 deploy로 넘어가는 흐름)
- 초점은 현재 디렉토리의 미니앱(`aitcc.yaml` 기준) 하나다 — workspace 전체
  앱 목록은 맥락 제공용으로만 보여주고, 요약은 현재 프로젝트에 집중한다.
