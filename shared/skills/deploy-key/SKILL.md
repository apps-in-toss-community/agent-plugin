---
name: deploy-key
description: |
  Issue a Deploy Key and save it to `~/.ait/credentials` so
  `ait deploy --profile <name>` works immediately — no plaintext echo, no
  argv exposure. Checks for a usable existing profile first; if one is
  valid and expires in 7+ days, skips issuance and reports the name.
  Triggered by `/ait deploy-key`.
argument-hint: '[profile-name]'
---

# deploy-key skill

## 목적

`ait deploy --profile <name>` 배포에 필요한 Deploy Key를 한 번 발급해
`~/.ait/credentials`에 프로파일로 저장한다.

- 기존 프로파일이 유효하면(만료 7일+ 이상) 재발급 없이 그 이름을 안내하고 종료.
- 프로파일이 없거나 만료 임박이면 `aitcc keys create --save-profile <name>`으로
  새 키를 발급한다. 발급된 키 값은 `aitcc`가 직접 파일로 저장하므로 model
  transcript나 stdout에 평문이 노출되지 않는다.

## 확인 — 기존 프로파일 검사

### 1. `aitcc` 설치 + 세션 확인

먼저 `aitcc` CLI가 설치되어 있는지 확인한다:

```bash
command -v aitcc
```

없으면 중단하고 설치를 안내한다:

```
console-cli(aitcc)가 PATH에 없습니다. 먼저 설치해주세요:

  npm i -g @ait-co/console-cli

설치 후 `aitcc login`으로 로그인하고 /ait deploy-key 를 다시 실행해주세요.
참고: https://github.com/apps-in-toss-community/console-cli
```

`aitcc`가 있으면 세션을 확인한다:

```bash
aitcc whoami --json
```

`aitcc`가 있는데도 비정상 exit(실행 오류)가 발생하면 stderr를 그대로 보여주고 중단한다.

`{ok:true, authenticated:false}` (exit 10) — 미인증이면 로그인이 필요하다:

```
로그인이 필요합니다. 다음 명령을 직접 실행해주세요:

  aitcc login

`aitcc login`은 시스템 Chrome 창을 엽니다 — 열린 창에서 앱인토스 콘솔(apps-in-toss.toss.im)에 계정으로 로그인하세요.
Chrome을 못 찾으면 exit 14로 실패하니 Chrome/Chromium을 설치하거나 `AITCC_BROWSER`로 경로를 지정하세요.

로그인 후 /ait deploy-key 를 다시 실행해주세요.
```

### 2. 기존 Deploy Key 목록 조회

```bash
aitcc keys ls --json
```

성공 시 `keys` 배열을 확인한다.

- `keys`가 비어 있으면(`needsKey: true`) "발급" 단계로 이동한다.
- 키가 하나 이상 있고, `expireTs`가 지금으로부터 7일(604,800,000 ms) 이상 남아
  있는 키가 있으면:

```
기존 Deploy Key 가 있습니다.
  키 이름: <name>   만료: <expireTs>

ait deploy --profile <profile-name> --scheme-only -m "<memo>"

프로파일 이름 <profile-name> 을 아직 저장하지 않았다면 아래 "발급" 단계를
실행해 --save-profile 로 저장하세요.
```

  재발급 없이 종료한다.

- 모든 키가 만료됐거나 7일 미만 남았으면 "발급" 단계로 이동한다.

## 발급

### 3. 프로파일 이름 결정

`/ait deploy-key <profile-name>` 으로 호출했으면 그 값을 쓴다.
인자가 없으면 cwd 기반으로 기본값을 제안한다:

```bash
basename "$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
```

기본 프로파일 이름: `aitc-<repo-name>-local`
예: `aitc-sdk-example-local`

이름 제약(console-cli 검증): ASCII 영문자·숫자·하이픈·언더스코어, 최대 16자.
16자를 초과하면 앞에서 16자 안으로 잘라낸다.

### 4. Deploy Key 발급 + 프로파일 저장

```bash
aitcc keys create --name <label> --save-profile <profile-name> --json
```

- `<label>`: 콘솔 UI용 레이블. 기본값 = `<profile-name>`.
- `--save-profile`: 발급 즉시 `~/.ait/credentials`에 `[<profile-name>]` 섹션을
  쓴다. `aitcc`가 직접 파일을 작성하므로 키 값이 stdout이나 model transcript에
  남지 않는다.
- `--json`: 결과를 파싱해 성공 여부·profile 저장 상태를 확인한다.

응답 확인 포인트:

| 필드 | 의미 |
|---|---|
| `ok: true` | 발급 성공 |
| `savedProfile` | 프로파일 파일 저장 성공 — 값은 프로파일 이름 |
| `saveProfileWarning` | 파일 저장 실패. `apiKey` 는 발급됐으므로 수동 저장 필요 |
| `ok: false` | 발급 실패 — `reason` 값으로 원인 판단 |

`saveProfileWarning`이 있으면 — Deploy Key는 발급됐지만 `~/.ait/credentials` 저장에 실패한 상태다.
(`aitcc`는 직접 쓰기를 먼저 시도하고, 실패하면 `ait token add` spawn 폴백을 시도한다. `saveProfileWarning`이 emit됐다면 두 경로 모두 실패한 것이다.)

다음 순서로 진단 + 복구한다:

**1단계: 권한 진단**

```bash
ls -la ~/.ait/
```

디렉토리 자체가 없거나 권한이 잘못됐으면 생성한다:

```bash
mkdir -p ~/.ait && chmod 700 ~/.ait
```

**2단계: 저장 재시도**

권한 해소 후 같은 명령을 다시 실행한다:

```bash
aitcc keys create --name <label> --save-profile <profile-name> --json
```

**3단계: 그래도 실패하면 외부 저장**

`--save-profile` 없이 발급하고 GitHub secret 등 외부 저장소에 보관한다:

```bash
aitcc keys create --name <label> --json
```

발급된 키 값을 GitHub 레포의 시크릿(`AITCC_API_KEY`)에 저장하면 CI/CD에서 `ait deploy --api-key` 로 소비할 수 있다.

키 값을 stdout/로그/채팅 화면에 평문으로 출력하지 않는다 — 발급 즉시 안전한 저장소로 옮긴다.

`ok: false`면 `reason`에 따라 안내한다:

| reason | 안내 |
|---|---|
| `no-workspace-selected` | `aitcc workspace use <workspaceId>` 후 재시도 |
| `invalid-name` | 프로파일 이름 규칙(ASCII 16자 이내) 확인 후 재시도 |
| auth/network 실패 | `aitcc login` 후 재시도 |

### 5. 발급 확인

`savedProfile`이 있을 때만 아래 확인을 실행한다.

```bash
ait token list 2>/dev/null | grep "<profile-name>" || echo "profile-check-skipped"
```

`ait`가 PATH에 없거나 명령이 실패해도 무시한다 — `aitcc`가 이미 파일 저장을
보고했으므로 (`savedProfile` 필드) 확인 실패가 전체 흐름을 막지 않는다.

## 다음 단계

```
Deploy Key 저장 완료 · 프로파일: <profile-name>

배포 명령:
  /ait deploy --profile <profile-name>

또는 직접:
  pnpm exec ait deploy --profile <profile-name> --scheme-only -m "<memo>"

번들 빌드 환경이 아직 없으면 /ait setup-bundle 을 먼저 실행하세요.
앱인토스 콘솔 등록이 안 됐으면 /ait register 를 먼저 실행하세요.
```

## 참고

- console-cli keys 명령: https://github.com/apps-in-toss-community/console-cli
- Deploy Key 운영 인스턴스 레퍼런스: https://github.com/apps-in-toss-community/console-cli/blob/main/docs/api/api-keys.md
- 짝 skill: `deploy` — 이 skill로 저장한 프로파일을 `ait deploy --profile` 로 소비.
- 짝 skill: `setup-bundle` — 번들 빌드 환경 설정 (이 skill의 전제 조건).
- 짝 skill: `register` — 앱인토스 콘솔 앱 등록.
