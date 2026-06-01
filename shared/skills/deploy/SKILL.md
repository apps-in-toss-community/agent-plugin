---
name: deploy
description: |
  Deploy the current mini-app bundle to Apps in Toss. Runs `ait build`
  (web-framework 3.0 bundler, produces `<appName>.ait`), then uploads via
  `aitcc app deploy <path-to-.ait>`. Interprets the result and surfaces the
  deploymentId for scheme URL lookup. Triggered by `/ait deploy`.
argument-hint: ''
---

# deploy skill

## 목적

`/ait deploy` 한 번으로 미니앱 번들을 빌드하고 앱인토스 콘솔에 업로드한다.

**3.0 배포 플로는 두 단계**로 분리된다:

1. **`ait build`** — `@apps-in-toss/web-framework`에 내장된 번들러. `apps-in-toss.config.ts`를 읽어 `<appName>.ait` 파일을 생성한다. 각 빌드에는 uuidv7 `deploymentId`가 내장된다.
2. **`aitcc app deploy <path-to-.ait>`** — console-cli(`aitcc`) 바이너리. `.ait`에서 `deploymentId`를 추출해 업로드 URL을 초기화하고, 번들 바이트를 PUT 업로드한다.

이 skill의 범위는 **빌드 확인 → `ait build` → `aitcc app deploy` → 결과 해석**으로 한정한다.
앱 등록(`aitcc app register`)은 사전에 완료되어 있어야 한다 — 이 skill이 수행하지 않는다.

생성·수정하는 모든 파일에서 "공식(official)", "토스가 제공하는", "powered by Toss" 등 제휴·후원·인증 암시 표현을 쓰지 않는다.

## 의존

- **번들 빌드 환경**: `apps-in-toss.config.ts`가 있어야 한다.
  없으면 `/ait setup-bundle`을 먼저 실행하도록 안내하고 중단.
- **`ait` 바이너리**: `@apps-in-toss/web-framework@3.0+`에 내장되어 있다.
  `pnpm exec ait build`가 동작하는 환경이면 이미 갖춰진 상태.
- **`aitcc` 바이너리**: console-cli(`@ait-co/console-cli`)가 설치되어 있어야 한다.
  없으면 `pnpm add -g @ait-co/console-cli`로 설치 안내.
- **`aitcc` 인증**: `aitcc login` 또는 `AITCC_API_KEY` 환경변수가 설정되어 있어야 한다.
  (`aitcc`의 Deploy Key 인증은 `aitcc login`/`AITCC_API_KEY` 경로를 사용한다 —
  `/ait deploy-key` skill이 이 설정을 담당한다.)
- **콘솔 앱 등록**: `aitcc.yaml`(또는 `aitcc/aitcc.yaml`)이 cwd에 있어야 한다.
  없으면 `/ait register` 선행 안내.

## 실행 순서

### 1. 사전 조건 확인

```bash
ls package.json apps-in-toss.config.ts
```

`package.json`이 없으면 중단:

```
package.json이 없습니다. 프로젝트 루트 디렉토리에서 다시 실행해주세요.
```

`apps-in-toss.config.ts`가 없으면 중단:

```
apps-in-toss.config.ts가 없습니다. 번들 빌드 환경이 설정되지 않았습니다.
먼저 /ait setup-bundle을 실행해주세요.
```

`granite.config.ts`만 있고 `apps-in-toss.config.ts`가 없는 경우:

```
granite.config.ts만 있고 apps-in-toss.config.ts가 없습니다.
web-framework 3.0에서 설정 파일 이름이 바뀌었습니다.

마이그레이션:
  pnpm exec ait migrate v3

이후 /ait deploy를 다시 실행해주세요.
```

`aitcc.yaml` 또는 `aitcc/aitcc.yaml`이 있는지 확인한다:

```bash
ls aitcc.yaml aitcc/aitcc.yaml 2>/dev/null
```

없으면 중단:

```
aitcc.yaml이 없습니다. 앱인토스 콘솔에 앱이 등록되지 않았습니다.
먼저 /ait register를 실행해주세요.
```

### 2. `aitcc` 인증 확인

`aitcc`는 두 가지 인증 경로를 지원한다.

**경로 A: `aitcc login` 세션 (권장)**

```bash
aitcc whoami 2>/dev/null
```

세션이 있으면 경로 A로 진행한다.

**경로 B: 환경변수 (CI/env-only 환경)**

`AITCC_API_KEY`가 세팅되어 있으면 경로 B로 진행한다:

```bash
echo "${AITCC_API_KEY:+set}"
```

둘 다 없으면 중단:

```
aitcc 인증이 없습니다. 다음 중 하나를 실행하세요.

로컬 개발:
  aitcc login

CI/env-only 환경:
  export AITCC_API_KEY=<Deploy Key>

Deploy Key 발급: /ait deploy-key
```

### 3. 번들 빌드 (`ait build`)

`apps-in-toss.config.ts`를 `Read`로 읽어 `appName`을 추출한다.
예상 산출물 파일명은 `<appName>.ait`.

```bash
ls *.ait 2>/dev/null
```

`.ait` 파일이 없거나 사용자가 재빌드를 원하면 빌드한다:

```bash
pnpm exec ait build
```

`pnpm`이 없으면:

```bash
npx ait build
```

빌드 성공 시 `<appName>.ait`가 프로젝트 루트에 생성된다.
빌드 실패 시 에러를 그대로 보여주고 중단.

### 4. 업로드 (`aitcc app deploy`)

```bash
aitcc app deploy ./<appName>.ait
```

CI 환경에서 `AITCC_API_KEY`를 쓰는 경우도 동일 명령이다
(`aitcc`가 환경변수를 자동으로 읽는다).

업로드가 완료되면 `aitcc`가 `deploymentId`를 출력한다.

### 5. 결과 해석

**성공 시** (exit 0):

```
배포 완료

deploymentId: <uuid>

scheme URL 확인:
  aitcc app bundles ls --json | jq '.[] | select(.deploymentId=="<uuid>") | .schemeUrl'

또는:
  aitcc app bundles ls

intoss-private:// scheme URL로 PREPARE 상태에서 cold-load:
  실기기 토스 앱에서 해당 URL을 QR/deep-link로 열면 candidate 번들이 로드됩니다.
  (/ait debug의 환경 3 경로)

[PREPARE 단계 주의]
앱의 serviceStatus가 PREPARE(출시 리뷰 통과 전)인 동안은
intoss:// URL(라이브)이 아닌 intoss-private:// URL(candidate)만 사용해야 합니다.
릴리즈 리뷰 제출은 aitcc app deploy --request-review 또는 콘솔 UI에서.
```

**에러 시** (non-zero exit):

stdout / stderr를 그대로 보여주고 진단 힌트를 추가한다.

| 에러 패턴 | 힌트 |
|---|---|
| `unauthorized` / `401` | Deploy Key가 잘못되었거나 만료됨. `/ait deploy-key`로 재발급. |
| `4037` / `4040` / `4099` / `5001` (약관 미체결) | `aitcc workspace terms agree <TYPE>`으로 동의 후 재시도. |
| `4046` (REVIEW lock) | 앱이 리뷰 중입니다. 운영팀 처리를 기다린 후 재시도. 새 앱 생성으로 우회 금지. |
| `.ait 없음` / `file not found` | Step 3 빌드 단계를 건너뛰었거나 빌드가 실패함. `pnpm exec ait build` 재실행. |
| 기타 | 에러 메시지를 그대로 보여주고 `aitcc` 로그 / GitHub Issues 안내. |

### 6. 완료 요약 + 다음 단계

배포 성공 후 한 블록으로 마무리한다:

```
배포 완료 · deploymentId: <uuid>

다음 단계:
  /ait status         # 콘솔에서 review/serviceStatus 확인
  /ait debug          # 환경 3: deploymentId로 실기기 QR attach
  # serviceStatus가 PREPARE면 intoss-private:// URL로 기기에서 dog-food
  # approved/OPENED면 intoss:// URL이 그대로 토스 앱에서 로드됨
```

## Out of scope (이 skill이 하지 않는 것)

- ❌ 앱 등록 — `/ait register` skill의 역할 (사전 작업).
- ❌ Deploy Key 발급 — `/ait deploy-key` skill의 역할.
- ❌ 콘솔 로그인(`aitcc login`) — 세션이 없으면 안내만 한다.
- ❌ 번들 빌드 환경 설정 — `/ait setup-bundle` skill.
- ❌ 리뷰 제출(`--request-review`) 자동화 — 릴리즈 노트 검토가 필요한 intentional 작업.

## 하지 말아야 할 것

- ❌ `4046` (REVIEW lock) 에러 시 새 앱 등록으로 우회. 운영팀 처리 대기가 올바른 경로.
- ❌ 에러 메시지 없이 "배포 실패"만 전달. 반드시 원인과 힌트를 제시.
- ❌ `apps-in-toss.config.ts`가 없는 상태에서 진행. Step 1에서 반드시 확인하고 중단.
- ❌ 존재하지 않는 `ait deploy --profile`, `ait deploy --api-key`, `ait deploy --scheme-only` 플래그 사용.
  3.0에서 `ait deploy`는 없다 — 빌드는 `ait build`, 업로드는 `aitcc app deploy`.

## 참고

- 짝 skill: `setup-bundle` (번들 빌드 환경 설정 — 이 skill의 전제 조건).
- 짝 skill: `deploy-key` (Deploy Key 발급 — `aitcc` 인증에 필요).
- 짝 skill: `status` (콘솔 인증 + 앱 상태 확인 — 배포 전 점검).
- `ait`(번들러, `@apps-in-toss/web-framework`에 내장)와 `aitcc`(콘솔 자동화, console-cli)는 다른 도구다.
- console-cli 레퍼런스: https://github.com/apps-in-toss-community/console-cli
- `@apps-in-toss/web-framework` (번들러 포함): https://www.npmjs.com/package/@apps-in-toss/web-framework
- 커뮤니티 docs: https://docs.aitc.dev/guides/navigation-flow
