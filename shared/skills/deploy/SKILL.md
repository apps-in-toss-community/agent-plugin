---
name: deploy
description: |
  Deploy the current mini-app bundle to Apps in Toss. Builds the `.ait`
  bundle if missing (`pnpm bundle:ait`), verifies console auth, then runs
  `ait deploy --api-key <key>` (Deploy Key supplied by the operator — not
  generated here). Interprets the result and surfaces the
  `intoss-private://` scheme URL. Includes a note on the PREPARE-stage
  `test-push` workaround for dog-food before review approval.
  Triggered by `/ait deploy`.
argument-hint: ''
---

# deploy skill

## 목적

`/ait deploy` 한 번으로 미니앱 번들을 앱인토스 콘솔에 업로드하고,
결과로 나오는 `intoss-private://` scheme URL을 사용자에게 전달한다.

이 skill의 범위는 **빌드 확인 → 업로드 → 결과 해석**으로 한정한다.
앱 등록(`aitcc app register`)과 Deploy Key 발급(`aitcc keys create`)은
사전에 완료되어 있어야 하며 — 이 skill이 수행하지 않는다.

생성·수정하는 모든 파일에서 "공식(official)", "토스가 제공하는", "powered by Toss" 등 제휴·후원·인증 암시 표현을 쓰지 않는다.

## 의존

- **번들 빌드 환경**: `granite.config.ts`와 `bundle:ait` 스크립트가 있어야 한다.
  없으면 `/ait setup-bundle`을 먼저 실행하도록 안내하고 중단.
- **`ait` CLI**: `@apps-in-toss/cli`가 `devDependencies`에 있어야 한다.
  `pnpm bundle:ait`가 동작하는 환경이면 이미 갖춰진 상태.
- **Deploy Key**: `ait deploy --api-key <key>` 호출에 필요한 자격증명.
  이 skill은 Deploy Key를 생성하거나 저장하지 않는다.
  키는 운영자가 CI secret 또는 환경변수(`AITCC_API_KEY`)로 관리한다.
- **콘솔 앱 등록**: `aitcc.yaml`(또는 `aitcc/aitcc.yaml`)이 cwd에 있어야 한다.
  없으면 `/ait register` 선행 안내.

> 이 skill은 Deploy Key를 **직접 발급하지 않는다**. 발급은
> `aitcc keys create`(콘솔 CLI)의 역할이며 운영자/maintainer가 결정한다.
> 키 이름은 편의상 "Deploy Key"로 부르지만, CLI flag는 `--api-key`.

## 실행 순서

### 1. 사전 조건 확인

```bash
ls package.json granite.config.ts
```

`package.json`이 없으면 중단:

```
package.json이 없습니다. 프로젝트 루트 디렉토리에서 다시 실행해주세요.
```

`granite.config.ts`가 없으면 중단:

```
granite.config.ts가 없습니다. 번들 빌드 환경이 설정되지 않았습니다.
먼저 /ait setup-bundle을 실행해주세요.
```

`package.json`을 `Read`로 읽어 `scripts["bundle:ait"]`가 있는지 확인한다.
없으면 중단:

```
package.json에 bundle:ait 스크립트가 없습니다.
먼저 /ait setup-bundle을 실행해주세요.
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

### 2. Deploy Key 확인

사용자에게 Deploy Key를 어떻게 제공할지 묻는다. 두 가지 경로:

**경로 A: 환경변수로 제공 (CI/자동화)**

```
Deploy Key가 환경변수 AITCC_API_KEY에 있으면 그대로 사용됩니다.
배포를 계속하려면 Enter를 눌러주세요.
```

`echo "${AITCC_API_KEY:+set}"` 으로 변수가 세팅되어 있는지 확인한다.
세팅되어 있으면 경로 A로 진행.

**경로 B: 직접 입력**

변수가 없으면 안전하게 입력받는다:

```
Deploy Key를 입력해주세요 (입력 내용은 화면에 표시되지 않습니다):
```

입력된 값은 메모리에만 두고 파일에 쓰지 않는다.

> Deploy Key가 없으면 콘솔 UI 또는 `aitcc keys create`로 발급한 후 다시 실행.

### 3. 번들 확인 + 빌드 (필요 시)

`granite.config.ts`를 `Read`로 읽어 `appName`을 추출한다.
예상 산출물 파일명은 `<appName>.ait`.

```bash
ls *.ait 2>/dev/null
```

`.ait` 파일이 없거나 사용자가 재빌드를 원하면 번들을 빌드한다:

```bash
pnpm bundle:ait
```

빌드 실패 시 에러를 그대로 보여주고 중단.
`pnpm`이 없으면 `npx ait build`로 fallback 안내.

### 4. 배포 실행

```bash
pnpm exec ait deploy --api-key "$AITCC_API_KEY" --scheme-only -m "<타임스탬프 또는 사용자 메모>"
```

- `--scheme-only`: 업로드 완료 후 stdout 마지막 줄에 `intoss-private://...` URL만 출력.
- `-m`: 배포 메모. 타임스탬프(`date +%Y-%m-%dT%H:%M:%S`)를 기본값으로 쓴다.
  사용자가 메모를 제공하면 그걸 쓴다.
- `--api-key`: 경로 A면 `"$AITCC_API_KEY"`, 경로 B면 메모리에서 삽입.

**실행 예**:

```bash
pnpm exec ait deploy --api-key "$AITCC_API_KEY" --scheme-only -m "v0.1.2 $(date +%Y-%m-%dT%H:%M:%S)"
```

### 5. 결과 해석

**성공 시** (exit 0, `intoss-private://`로 끝나는 stdout):

```
배포 완료

scheme URL:
  intoss-private://...

이 URL을 토스 앱에서 열면 업로드된 번들을 로드합니다.

[PREPARE 단계 주의]
앱의 serviceStatus가 PREPARE(출시 리뷰 통과 전)인 동안은
토스 앱이 이 URL로 actual bundle을 로드하지 않습니다.
리뷰 통과 전에 기기에서 직접 확인하려면 test-push를 사용하세요:

  aitcc app bundles test-push --deployment-id <deploymentId>

deploymentId는 배포 stdout 또는 aitcc app bundles ls --json 에서 확인.
test-push는 업로더 기기로 푸시 알림을 보내고, 그 알림으로 번들을 로드합니다.
```

**에러 시** (non-zero exit):

stdout / stderr를 그대로 보여주고 진단 힌트를 추가한다.

| 에러 패턴 | 힌트 |
|---|---|
| `unauthorized` / `401` | Deploy Key가 잘못되었거나 만료됨. `aitcc keys create`로 재발급. |
| `4037` / `4040` / `4099` / `5001` (약관 미체결) | 해당 약관을 `aitcc workspace terms agree <TYPE>`으로 동의 후 재시도. |
| `4046` (REVIEW lock) | 앱이 리뷰 중입니다. 운영팀 처리를 기다린 후 재시도. 새 앱 생성으로 우회 금지. |
| `bundle not found` / `*.ait 없음` | Step 3 빌드 단계를 건너뛰었거나 빌드가 실패함. `pnpm bundle:ait` 재실행. |
| 기타 | 에러 메시지를 그대로 보여주고 `aitcc` 로그 / GitHub Issues 안내. |

### 6. 완료 요약 + 다음 단계

배포 성공 후 한 블록으로 마무리한다:

```
배포 완료 · scheme URL: intoss-private://... · 메모: <memo>

다음 단계:
  /ait status         # 콘솔에서 review/serviceStatus 확인
  # serviceStatus가 PREPARE면 위 test-push 안내로 기기에서 dog-food
  # approved/OPENED면 scheme URL이 그대로 토스 앱에서 로드됨
```

## Out of scope (이 skill이 하지 않는 것)

- ❌ 앱 등록 — `/ait register` skill의 역할 (사전 작업).
- ❌ Deploy Key 발급(`aitcc keys create`) — 운영자/maintainer 결정.
- ❌ 콘솔 로그인(`aitcc login`) — 이 skill은 `ait deploy --api-key`(Deploy Key 인증)를 쓰므로 `aitcc` 세션이 필요 없다. (세션 기반 배포가 필요하면 `aitcc app deploy`를 직접 사용.)
- ❌ `test-push` 자동 호출 — 운영자가 기기 직접 확인 후 결정하는 흐름.
- ❌ `bundle:ait` 환경 설정 — `/ait setup-bundle` skill.
- ❌ 리뷰 제출(`--request-review`) 자동화 — 릴리즈 노트 검토가 필요한 intentional 작업.

## 하지 말아야 할 것

- ❌ Deploy Key를 파일에 쓰거나 커밋에 포함. 메모리에서만 사용.
- ❌ `4046` (REVIEW lock) 에러 시 새 앱 등록으로 우회. 운영팀 처리 대기가 올바른 경로.
- ❌ 에러 메시지 없이 "배포 실패"만 전달. 반드시 원인과 힌트를 제시.
- ❌ `granite.config.ts`가 없는 상태에서 진행. Step 1에서 반드시 확인하고 중단.

## 참고

- 짝 skill: `setup-bundle` (번들 빌드 환경 설정 — 이 skill의 전제 조건).
- 짝 skill: `status` (콘솔 인증 + 앱 상태 확인 — 배포 전 점검).
- console-cli 레퍼런스: https://github.com/apps-in-toss-community/console-cli
- `@apps-in-toss/cli` (번들러): https://www.npmjs.com/package/@apps-in-toss/cli
- test-push 배경: umbrella `CLAUDE.md` "Dog-food 흐름" 단락
- 커뮤니티 docs: https://docs.aitc.dev/
