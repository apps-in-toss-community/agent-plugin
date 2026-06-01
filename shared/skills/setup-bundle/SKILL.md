---
name: setup-bundle
description: |
  Wire up the native Apps in Toss bundle build (`.ait`) into an existing
  mini-app project. Generates `apps-in-toss.config.ts`, adds the `bundle:ait`
  script to package.json, and appends `.gitignore` entries — all idempotently.
  If `apps-in-toss.config.ts` already exists, reports and stops rather than
  overwriting hand-edited config. Triggered by `/ait setup-bundle`.
argument-hint: ''
---

# setup-bundle skill

## 목적

`/ait setup-bundle` 한 번으로 기존 앱인토스 미니앱 프로젝트에 네이티브 번들
빌드(`.ait`) 환경을 추가한다.

이 skill이 완료되면:
- `ait build` 한 번으로 토스 앱이 로드할 수 있는 `.ait` 번들이 생성된다.
- 번들 빌드 산출물(`.ait`)은 자동으로 gitignore된다.
- 다음 단계(`/ait register` → `/ait deploy`)로 바로 이어질 수 있다.

생성·수정하는 모든 파일에서 "공식(official)", "토스가 제공하는", "powered by Toss" 등 제휴·후원·인증 암시 표현을 쓰지 않는다.

## 의존

- **`@apps-in-toss/web-framework`가 dependencies에 있어야 한다.** 없으면 이
  프로젝트가 앱인토스 미니앱인지 확신할 수 없으므로 중단하고 사용자에게 알린다.
- **`package.json`이 cwd에 있어야 한다.** 없으면 프로젝트 루트로 이동하도록 안내.
- `@apps-in-toss/web-framework@3.0+`에는 `ait` 바이너리가 포함되어 있다.
  별도로 `@apps-in-toss/cli`를 설치하지 않아도 된다.
  (`@apps-in-toss/cli@latest`는 `bin: null`로 비워진 상태 — 설치해도 명령이 없다.)

이 skill은 콘솔 인증을 요구하지 않는다. 번들 빌드는 로컬 전용.
앱 등록(`aitcc app register`)은 `/ait register`가 담당한다 — 이 skill의 범위 밖.

## 입력 (프롬프트)

이 skill은 실행 중 다음 값을 사용자에게 묻는다.

| 항목 | 설명 | 기본값 |
|---|---|---|
| `appName` | 앱인토스 콘솔 등록명. 영문 소문자, 하이픈 허용. | `package.json`의 `name` 필드 |
| `primaryColor` | 브랜드 주색상. `#RRGGBB` 형식. | `#3182F6` |

**3.0 config 스키마 변경 사항**:
- `brand`에는 `primaryColor`만 유지된다 (`displayName`, `icon` 등은 제거됨).
- `web{}` 블록(host/port/commands)은 없다 — dev server 설정은 `package.json` scripts로 관리.
- `outdir` → `webBundleDir` (Vite 빌드 출력 디렉토리, 보통 `dist`).
- `navigationBar`는 필수가 아니다.

## 실행 순서

### 1. 사전 조건 확인

```bash
ls package.json
```

`package.json`이 없으면 즉시 중단:

```
package.json이 없습니다. 프로젝트 루트 디렉토리에서 다시 실행해주세요.
예: cd <project-root> && /ait setup-bundle
```

`package.json`을 `Read` tool로 읽고 `dependencies`와 `devDependencies`를
확인한다.

`@apps-in-toss/web-framework`가 어느 쪽에도 없으면 중단:

```
@apps-in-toss/web-framework가 package.json에 없습니다.
이 명령은 앱인토스 미니앱 프로젝트에서만 실행할 수 있습니다.

새 프로젝트를 시작하려면: /ait new <app-name>
```

### 2. `apps-in-toss.config.ts` 충돌 확인 (idempotency 선행 검사)

```bash
ls apps-in-toss.config.ts
```

파일이 이미 있으면 **즉시 중단**한다. 덮어쓰지 않는다:

```
apps-in-toss.config.ts가 이미 존재합니다. 수동 편집된 파일일 수 있으므로
덮어쓰지 않습니다.

파일 내용을 확인하고, 필요하면 직접 수정해주세요.
나머지 단계(bundle:ait 스크립트, .gitignore)는 계속 진행하려면
apps-in-toss.config.ts를 잠깐 이름 변경해두거나,
각 단계를 수동으로 적용하세요.
```

`granite.config.ts`(구 버전 설정 파일)가 있으면 마이그레이션을 안내한다:

```
granite.config.ts가 발견됐습니다. 이 파일은 web-framework 2.x의 설정 파일입니다.
3.0에서는 apps-in-toss.config.ts로 이름이 바뀌었고 스키마도 변경됐습니다.

자동 마이그레이션:
  pnpm exec ait migrate v3

또는 수동으로:
  1. granite.config.ts → apps-in-toss.config.ts 로 이름 변경
  2. brand 블록: primaryColor만 유지 (displayName/icon 등 제거)
  3. web{} 블록 전체 제거
  4. outdir → webBundleDir
  5. package.json의 build 스크립트 끝에 && ait build 추가

마이그레이션 후 /ait setup-bundle을 다시 실행해주세요.
```

중단.

### 3. 입력값 수집

사용자에게 순서대로 묻는다.

1. **appName**: `package.json`의 `name`을 기본값으로 제안. 사용자가 Enter를
   누르면 그대로 사용.
2. **primaryColor**: 기본값 `#3182F6`. Enter 시 기본값 사용.

### 4. `apps-in-toss.config.ts` 생성

Step 2에서 파일이 없음을 이미 확인했으므로 `Write` tool로 바로 생성한다.

```ts
import { defineConfig } from '@apps-in-toss/web-framework/config';

export default defineConfig({
  appName: '<appName>',
  brand: {
    primaryColor: '<primaryColor>',
  },
  webBundleDir: 'dist',
  permissions: [],
});
```

`permissions: []`는 처음 빌드 통과용 placeholder다. SDK 호출에 권한 prompt가
필요한 도메인을 사용하면 이 배열에 추가한다.

**3.0 config 핵심 규칙**:
- `defineConfig` import 경로는 `@apps-in-toss/web-framework/config` (변경 없음).
- `brand` 블록에는 `primaryColor`만 — `displayName`, `icon` 등은 3.0에서 제거됨.
- `web{}` 블록(host/port/commands)은 쓰지 않는다 — 3.0에서 제거됨.
- `outdir`이 아니라 `webBundleDir` — Vite 빌드 출력 디렉토리를 가리킨다.

### 5. `bundle:ait` 스크립트 추가 (idempotent)

`package.json`을 `Read`로 읽어 `scripts["bundle:ait"]`가 이미 있으면 skip.
없으면 `Edit` tool로 `scripts` 객체에 추가.

3.0 번들 빌드는 **두 단계**다:
1. `vite build` (Vite 빌드 → `dist/` 출력)
2. `ait build` (web-framework에 내장된 번들러 → `<appName>.ait` 생성)

`package.json`의 기존 `build` 스크립트를 확인한다.

기존 `build` 스크립트 끝에 `&& ait build`가 없으면 추가한다:

```jsonc
// 예: "tsc -b && vite build" → "tsc -b && vite build && ait build"
```

`scripts["bundle:ait"]`는 `ait build` 단독으로 설정한다
(이미 vite build가 된 상태에서 `.ait` 파일만 재생성할 때 사용):

```json
"bundle:ait": "ait build"
```

`Edit` tool 사용 시 기존 scripts 마지막 항목 뒤에 삽입하는 방식으로
파일 전체를 재작성하지 않는다.

### 6. `.gitignore` 항목 추가 (idempotent)

`.gitignore`를 `Read`로 읽는다 (없으면 신설).

이미 `*.ait`가 있으면 skip.

없는 항목만 파일 끝에 추가한다:

```
# Apps in Toss bundle artifacts
*.ait
```

`# Apps in Toss bundle artifacts` 주석은 한 번만 추가한다.

### 7. 완료 안내

```
setup-bundle 완료

변경 내용:
  - apps-in-toss.config.ts 생성
  - package.json: build 스크립트 끝에 && ait build 추가
  - package.json: scripts.bundle:ait 추가 ("ait build")
  - .gitignore: *.ait 추가

번들 빌드:
  pnpm build         # vite build + ait build → <appName>.ait 생성
  pnpm bundle:ait    # ait build만 재실행 (이미 dist/ 가 있을 때)

다음 단계:
  /ait register      # 앱인토스 콘솔에 앱 등록 (aitcc.yaml 생성 → aitcc app register)
  /ait deploy        # 번들을 앱인토스 콘솔에 업로드 (ait build + aitcc app deploy)

참고:
  - apps-in-toss.config.ts의 permissions: []는 placeholder입니다.
    SDK 권한 prompt가 필요한 API를 사용한다면 여기에 추가하세요.
  - ait 바이너리는 @apps-in-toss/web-framework에 포함되어 있습니다.
    별도로 @apps-in-toss/cli를 설치할 필요가 없습니다.
```

## Out of scope (이 skill이 하지 않는 것)

- ❌ 콘솔 앱 등록 — `/ait register` skill의 역할 (비대화형 앱 등록).
- ❌ 배포 업로드 — `/ait deploy` skill.
- ❌ 기존 `apps-in-toss.config.ts` 수정 — 수동 편집 내용을 보호하기 위해 파일이 있으면 중단.
- ❌ `ait build` 실행 검증 — 설정만 추가하고 빌드 실행은 사용자에게 위임.
- ❌ `granite.config.ts` 마이그레이션 자동 실행 — `ait migrate v3` 실행을 안내하고 중단.

## 하지 말아야 할 것

- ❌ `apps-in-toss.config.ts`가 이미 있으면 어떤 이유로도 덮어쓰기. 사용자 작업 보호 최우선.
- ❌ `brand` 블록에 `displayName`이나 `icon` 추가 — 3.0 스키마에서 제거됨.
- ❌ `web{}` 블록 생성 — 3.0에서 제거됨. dev server는 package.json scripts로.
- ❌ `outdir` 키 사용 — 3.0에서 `webBundleDir`로 이름이 바뀜.
- ❌ `@apps-in-toss/cli` 별도 설치 — 3.0부터 `ait` 바이너리는 `@apps-in-toss/web-framework`에 내장.
- ❌ 생성되는 주석이나 메시지에 "공식(official)", "토스가 제공하는", "powered by Toss"
  등 제휴·후원·인증 암시 표현.
- ❌ `package.json` 전체 재작성 — `Edit` tool로 최소 변경.

## 참고

- 짝 skill: `deploy` (`ait build` 후 `aitcc app deploy`로 업로드).
- 짝 skill: `new-miniapp` (새 프로젝트 생성 — `apps-in-toss.config.ts` 없는 상태에서 시작).
- `@apps-in-toss/web-framework` (번들러 포함): https://www.npmjs.com/package/@apps-in-toss/web-framework
- 커뮤니티 docs: https://docs.aitc.dev/guides/navigation-flow
