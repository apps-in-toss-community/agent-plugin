---
name: register
description: |
  Register the current mini-app with the Apps in Toss console — the step
  between bundling and deploying. Scaffolds the `aitcc.yaml` manifest
  non-interactively (the work `aitcc app init` does, but `app init` is
  TTY-only so an agent can't run it), discovers `workspaceId` /
  `categoryIds` via `aitcc whoami --json` and `aitcc app categories
  --selectable --json`, then runs `aitcc app register --config
  ./aitcc.yaml --json` (offer `--dry-run` first; `--accept-terms` only
  with explicit user consent). Never overwrites an existing manifest.
  Triggered by `/ait register`.
argument-hint: ''
---

# register skill

## 목적

`/ait register` 한 번으로 현재 미니앱을 앱인토스 콘솔에 등록한다.
이 skill은 harness에서 번들 빌드(`/ait setup-bundle`)와 배포(`/ait deploy`)
사이의 빈 칸을 메운다.

핵심은 **`aitcc.yaml` 매니페스트를 비대화형으로 생성**하는 것이다.
`aitcc app init`은 같은 매니페스트를 만들지만 TTY 전용 명령이라
(`--json`/non-TTY 거부, `{ok:false,reason:'interactive-required'}` exit 2)
에이전트가 실행할 수 없다. 반면 `aitcc app register`는 완전히
non-TTY로 동작한다 — 막혀 있던 건 매니페스트 *생성*뿐이다. 이 skill이
그 생성을 대신해서 등록 절차 전체를 에이전트 안에서 끝낼 수 있게 한다.

이 skill이 완료되면:
- 프로젝트 루트에 `aitcc.yaml`이 생성된다(이미 있으면 보존).
- 등록이 제출되고, 서버가 돌려준 `miniAppId`가 `aitcc.yaml`에 자동 기록된다 —
  이후 `/ait deploy`·`/ait status`가 같은 앱을 가리킨다.

생성·수정하는 모든 파일에서 "공식(official)", "토스가 제공하는", "powered by Toss" 등 제휴·후원·인증 암시 표현을 쓰지 않는다.

## 의존

- **`aitcc` CLI** (`@ait-co/console-cli`)가 실행 가능해야 한다.
  콘솔 자동화 명령(`whoami`/`app categories`/`app register`)을 호출한다.
- **로그인된 `aitcc` 세션**이 필요하다. 이 skill은 콘솔 세션(쿠키 기반)으로
  동작하며, `aitcc whoami --json`으로 인증을 확인한다. 인증되어 있지 않으면
  사용자에게 `aitcc login`을 직접 실행하도록 안내하고 중단한다 —
  **대화형 로그인은 skill 안에서 절대 호출하지 않는다**.
- **이미지 자산**: `./assets/`에 정확한 규격의 PNG가 준비되어 있어야 한다
  (아래 "입력" 참조). 이 skill은 이미지를 생성하지 않는다.

> **세션 ≠ Deploy Key.** 등록은 콘솔 **세션**(`aitcc login`으로 로그인)을
> 사용하고, 배포(`/ait deploy`)는 **Deploy Key**(`--api-key`)를 사용한다.
> 둘은 서로 다른 자격증명이다 — 혼동하지 않는다. 이 skill은 Deploy Key를
> 발급하지도 사용하지도 않는다.

## 입력

### 매니페스트 필수 필드 (console-cli가 검증)

| 필드 | 설명 | 제약 |
|---|---|---|
| `workspaceId` | 워크스페이스 ID (정수) | `aitcc whoami --json`으로 발견 |
| `titleKo` | 한국어 앱 제목 | 허용 문자: 한글·영문자·숫자·공백 + `: · ?`만. 공백 제외 ≤ 10 코드포인트 |
| `titleEn` | 영어 앱 제목 | `[A-Za-z0-9 :·?]`만. 공백 제외 ≤ 15 코드포인트. 각 단어는 Title-Case |
| `appName` | 콘솔 앱 식별자 | `^[a-z][a-z0-9-]*$` (소문자 시작, kebab-case) |
| `csEmail` | 고객지원 이메일 | 유효한 이메일 |
| `subtitle` | 한 줄 부제 | ≤ 20자 |
| `description` | 앱 설명 (블록 스칼라) | ≤ 500 코드포인트 |
| `categoryIds` | 카테고리 ID 배열 | 정수 ≥ 1개. `aitcc app categories --selectable --json`으로 발견 |
| `logo` | `./assets/logo.png` | 600×600 PNG |
| `horizontalThumbnail` | `./assets/thumbnail.png` | 1932×828 PNG |
| `verticalScreenshots` | 경로 ≥ 3개 | 각 636×1048 PNG |

**`titleEn` 주의**: 각 단어는 Title-Case여야 한다(첫 글자 대문자, 나머지 소문자).
`SDK`·`AITC` 같은 전부 대문자 토큰은 서버가 거부한다 — 사용자에게 미리 알린다.
(예: `AITC SDK Example` ✗ → `Aitc Sdk Example` ✓)

### 매니페스트 선택 필드 (주석 처리해서 emit)

`aitcc app init`처럼 주석 처리된 라인으로 남겨둔다.

| 필드 | 설명 | 제약 |
|---|---|---|
| `homePageUri` | 홈페이지 URL | http/https |
| `logoDarkMode` | `./assets/logo-dark.png` | 600×600 PNG |
| `keywords` | 키워드 배열 | ≤ 10개 |
| `horizontalScreenshots` | 가로 스크린샷 경로 | 각 1504×741 PNG |

### 이미지 자산 (사용자가 `./assets/`에 직접 배치)

이 skill은 이미지를 생성·리사이즈하지 않는다. 규격은 등록 시점에
로컬 + 서버 양쪽에서 강제된다.

| 파일 | 규격 | 개수 |
|---|---|---|
| `assets/logo.png` | 600×600 | 1 (필수) |
| `assets/thumbnail.png` | 1932×828 | 1 (필수) |
| `assets/screenshot-*.png` | 636×1048 | ≥ 3 (필수, 세로) |
| `assets/logo-dark.png` | 600×600 | 선택 |
| `assets/screenshot-h-*.png` | 1504×741 | 선택 (가로) |

## 실행 순서

### 1. 사전 조건 확인

```bash
ls package.json
```

`package.json`이 없으면 중단:

```
package.json이 없습니다. 프로젝트 루트 디렉토리에서 다시 실행해주세요.
예: cd <project-root> && /ait register
```

### 2. 매니페스트 충돌 확인 (idempotency 선행 검사)

```bash
ls aitcc.yaml aitcc.json 2>/dev/null
```

파일이 이미 있으면 **덮어쓰지 않는다**. 사용자에게 알리고 두 갈래로 분기:

```
aitcc.yaml이 이미 존재합니다. 수동 편집된 매니페스트일 수 있으므로
덮어쓰지 않습니다.

  1) 기존 매니페스트로 그대로 등록을 진행한다  → Step 6(등록)으로 건너뜀
  2) 중단한다 — 내용을 직접 확인 후 다시 실행한다

어느 쪽으로 진행할지 알려주세요.
```

사용자가 (1)을 고르면 매니페스트 생성(Step 4·5)을 건너뛰고 Step 6으로 간다.

### 3. 콘솔 인증 확인

```bash
aitcc whoami --json
```

- `{ok:true, authenticated:false}` (exit 10) → 중단하고 안내:

  ```
  앱인토스 콘솔에 로그인되어 있지 않습니다. 다음 명령을 직접 실행해주세요:

    aitcc login

  로그인 후 /ait register를 다시 실행하세요.
  ```

  대화형 로그인은 skill이 직접 호출하지 않는다.

- 인증되어 있으면 응답의 워크스페이스 목록을 읽는다.
  - 워크스페이스가 **정확히 1개**면 그 `workspaceId`를 사용.
  - **여러 개**면 목록을 보여주고 사용자에게 어느 `workspaceId`로 등록할지 묻는다.

### 4. 동적 값 발견 + 입력 수집

매니페스트를 새로 생성하는 경우(Step 2에서 (1)을 고르지 않은 경우)에만 수행.

**카테고리 발견**:

```bash
aitcc app categories --selectable --json
```

`{ok:true, categories:[…]}`의 selectable leaf들(숫자 id 포함)을 사용자에게
제시하고 ≥ 1개를 고르게 한다. **id를 하드코딩하지 않는다** — 매번 라이브
서버 값을 조회한다.

**나머지 필드**를 사용자에게 묻는다(기본값 제안):

1. `titleKo` — 한국어 제목 (제약: 공백 제외 ≤ 10자, 허용 문자 안내).
2. `titleEn` — 영어 제목 (Title-Case 강제, 전부 대문자 토큰 거부 경고).
3. `appName` — kebab-case. `package.json`의 `name`을 기본값으로 제안.
4. `csEmail` — 고객지원 이메일.
5. `subtitle` — ≤ 20자.
6. `description` — ≤ 500자.

가능하면 로컬에서 제약을 미리 검증해서, 명백히 규칙을 어기는 입력은
서버 왕복 전에 다시 묻는다.

### 5. `./assets/` 디렉토리 + `aitcc.yaml` 생성

`./assets/`를 만든다(없을 때만):

```bash
mkdir -p assets
```

이미지가 다 준비되어 있는지 확인하고, 빠진 게 있으면 규격과 함께 안내한다
(이 skill은 이미지를 만들지 않는다 — 사용자가 배치):

```
./assets/ 에 다음 PNG를 준비해주세요:
  - logo.png             600×600        (필수)
  - thumbnail.png        1932×828       (필수)
  - screenshot-1.png …   636×1048       (필수, 세로 ≥ 3장)
  - logo-dark.png        600×600        (선택)
  - screenshot-h-1.png   1504×741       (선택, 가로)
규격은 등록 시점에 로컬 + 서버에서 검증됩니다.
```

그런 다음 `Write` tool로 `aitcc.yaml`을 생성한다. console-cli의
`renderInitYaml()` 레이아웃을 그대로 따른다 — 헤더 주석 + 필수 블록 +
주석 처리된 선택 블록. `titleKo`/`titleEn`/`subtitle`은 콜론 안전을 위해
큰따옴표 스칼라로 쓴다. `miniAppId`는 주석으로만 둔다(등록이 자동 기록).

```yaml
# Apps in Toss 미니앱 등록 매니페스트 (aitcc app register --config ./aitcc.yaml)
# 커뮤니티 오픈소스 console-cli(aitcc)가 읽는 파일입니다.
# miniAppId: <등록 후 register가 자동으로 기록합니다 — 직접 채우지 마세요>

workspaceId: <number>

titleKo: "<한국어 제목>"
titleEn: "<English Title>"
appName: <kebab-case>
csEmail: <support@example.com>
subtitle: "<한 줄 부제>"
description: |-
  <앱 설명. 여러 줄 가능. 최대 500자.>

categoryIds: [<id>, ...]

logo: ./assets/logo.png
horizontalThumbnail: ./assets/thumbnail.png
verticalScreenshots:
  - ./assets/screenshot-1.png
  - ./assets/screenshot-2.png
  - ./assets/screenshot-3.png

# --- 선택 필드 (필요하면 주석 해제) ---
# homePageUri: "https://example.com"
# logoDarkMode: ./assets/logo-dark.png
# keywords: [foo, bar]
# horizontalScreenshots:
#   - ./assets/screenshot-h-1.png
```

### 6. 등록 실행

등록은 **앱을 리뷰에 제출**하고 콘솔의 필수 약관 동의를 수반한다.
실제 제출 전에, 먼저 `--dry-run`으로 매니페스트 + 이미지 규격을 검증할 것을
권한다(`--accept-terms` 불필요):

```bash
aitcc app register --config ./aitcc.yaml --dry-run --json
```

- `{ok:true, dryRun:true, workspaceId, payload}` (exit 0) → payload 요약을
  사용자에게 보여주고, 실제 제출로 진행할지 묻는다.

**실제 제출**은 `--accept-terms`가 필요하다. 이 플래그를 붙이기 전에
다음을 사용자에게 명시하고 **명시적 동의**를 받는다:

```
등록을 진행하면 이 앱이 앱인토스 콘솔에 리뷰 제출되며,
콘솔의 필수 약관(법적 동의 항목)에 동의하는 것으로 처리됩니다.

진행하려면 동의를 확인해주세요. (--accept-terms로 제출됩니다)
```

동의를 받은 뒤에만:

```bash
aitcc app register --config ./aitcc.yaml --accept-terms --json
```

### 7. 결과 해석

**성공** — `{ok:true, workspaceId, appId, reviewState, consoleUrl}` (exit 0):

```
등록 완료

  appId:       <appId>
  reviewState: <reviewState>
  콘솔:        <consoleUrl>     (서버가 miniAppId를 생략하면 null)

서버가 돌려준 miniAppId가 aitcc.yaml에 자동 기록되었습니다.
이제 /ait deploy 와 /ait status 가 이 앱을 가리킵니다.

다음 단계:
  /ait deploy            # 번들을 이 앱에 업로드
```

`consoleUrl`은 콘솔 딥링크다(서버가 miniAppId를 생략하면 null).

**실패** — 각 `reason`을 한국어 진단 + 수정 힌트로 매핑한다(특별히 명시한
경우 외 exit 2):

| reason (exit) | 진단 + 힌트 |
|---|---|
| `no-workspace-selected` (2) | workspaceId가 정해지지 않음. `aitcc.yaml`에 설정하거나 `--workspace`로 전달. |
| `invalid-config` (2, `message`) | 매니페스트 형식/검증 오류. `message`를 그대로 보여줌. |
| `missing-required-field` (2, `field`,`message`) | 빠진 필드(`field`)를 지목. |
| `image-dimension-mismatch` (2, `path`,`expected`,`actual`,`message`) | 어느 이미지(`path`)가 규격(`expected`)과 다른지(`actual`) 안내. |
| `image-unreadable` (2, `path`,`message`) | `path`의 이미지가 없거나 손상됨. |
| `terms-not-accepted` (2, `message`) | 사용자 동의를 다시 받아 `--accept-terms`로 재실행. |
| `authenticated:false` (10) | `aitcc login` 직접 실행 후 재시도. |
| `network-error` (11, `message`) | 네트워크 오류. `message`를 보여주고 재시도. |
| `api-error` (17, `status?`,`errorCode?`,`message`) | 서버 `errorCode`를 surface. **`4046` = REVIEW lock** → 운영팀 처리 대기. **새 앱 생성으로 우회하지 않는다**(anti-pattern). |

`api-error`는 항상 `errorCode`를 그대로 보여준다. `4046`이 오면 앱이
리뷰 잠금 상태이므로 업데이트가 막힌 것 — 운영팀 처리를 기다리고, 우회용으로
새 앱을 만들지 않는다.

## Out of scope (이 skill이 하지 않는 것)

- ❌ 이미지 생성·리사이즈 — 사용자가 `./assets/`에 규격대로 배치.
- ❌ 번들 빌드(`/ait setup-bundle`)와 배포(`/ait deploy`) — register는 둘 **사이**의 단계. 두 짝 skill을 cross-ref.
- ❌ Deploy Key 발급(`aitcc keys create`) — 등록은 세션, 배포는 Deploy Key.
- ❌ 대화형 로그인(`aitcc login`) — skill 안에서 절대 호출하지 않는다.
- ❌ `categoryIds` 하드코딩 — 매번 `aitcc app categories --selectable --json`로 발견.

## 하지 말아야 할 것

- ❌ 기존 `aitcc.yaml`/`aitcc.json`을 어떤 이유로도 덮어쓰기. 사용자 작업 보호 최우선 — 보존하고 재사용하거나 중단.
- ❌ 사용자 명시 동의 없이 `--accept-terms`로 제출. 리뷰 제출 + 약관 동의를 먼저 surface하고 go-ahead를 받는다.
- ❌ Deploy Key·세션 자격증명을 파일에 쓰기. 등록은 콘솔 세션을 사용하고, 비밀은 디스크에 남기지 않는다.
- ❌ `4046` (REVIEW lock) 시 새 앱 등록으로 우회. 운영팀 처리 대기가 올바른 경로.
- ❌ 에러 메시지 없이 "등록 실패"만 전달. 반드시 `reason`/`message`/`errorCode`와 힌트를 제시.
- ❌ 생성되는 주석이나 메시지에 "공식(official)", "토스가 제공하는", "powered by Toss" 등 제휴·후원·인증 암시 표현.

## 참고

- 짝 skill: `setup-bundle` (번들 빌드 환경 설정 — register 앞 단계).
- 짝 skill: `deploy` (등록된 앱에 번들 업로드 — register 뒤 단계).
- 짝 skill: `status` (콘솔 인증 + 앱 상태 확인).
- console-cli 레퍼런스: https://github.com/apps-in-toss-community/console-cli
- 커뮤니티 docs: https://docs.aitc.dev/
