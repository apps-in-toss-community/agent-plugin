---
name: setup-bundle
description: |
  Wire up the native Apps in Toss bundle build (`.ait`) into an existing
  mini-app project. Installs `@apps-in-toss/cli` as a dev dep, generates
  `granite.config.ts`, adds the `bundle:ait` script to package.json, and
  appends `.gitignore` entries — all idempotently. If `granite.config.ts`
  already exists, reports and stops rather than overwriting hand-edited
  config. Triggered by `/ait setup-bundle`.
argument-hint: ''
---

# setup-bundle skill

## 목적

`/ait setup-bundle` 한 번으로 기존 앱인토스 미니앱 프로젝트에 네이티브 번들
빌드(`.ait`) 환경을 추가한다.

이 skill이 완료되면:
- `pnpm bundle:ait` 한 번으로 토스 앱이 로드할 수 있는 `.ait` 번들이 생성된다.
- 번들 빌드 산출물(`.ait`, `.granite/`)은 자동으로 gitignore된다.
- 다음 단계(`/ait deploy`)로 바로 이어질 수 있다.

생성·수정하는 모든 파일에서 "공식(official)", "토스가 제공하는", "powered by Toss" 등 제휴·후원·인증 암시 표현을 쓰지 않는다.

## 의존

- **`@apps-in-toss/web-framework`가 dependencies에 있어야 한다.** 없으면 이
  프로젝트가 앱인토스 미니앱인지 확신할 수 없으므로 중단하고 사용자에게 알린다.
- **`package.json`이 cwd에 있어야 한다.** 없으면 프로젝트 루트로 이동하도록 안내.
- **pnpm / npm / yarn / bun** 중 하나가 필요하다. 감지 순서:
  `pnpm-lock.yaml` → `package-lock.json` → `yarn.lock` → `bun.lockb`.
  아무것도 없으면 `pnpm`으로 가정.
- 인터넷 연결 필요 (`@apps-in-toss/cli` npm 설치).

> 이 skill은 콘솔 인증을 **요구하지 않는다**. 번들 빌드는 로컬 전용.
> 앱 등록(`aitcc app register`)과 Deploy Key 발급(`aitcc keys create`)은
> 별도 작업이다 — 이 skill의 범위 밖.

## 입력 (프롬프트)

이 skill은 실행 중 다음 값을 사용자에게 묻는다.

| 항목 | 설명 | 기본값 |
|---|---|---|
| `appName` | 앱인토스 콘솔 등록명. 영문 소문자, 하이픈 허용. | `package.json`의 `name` 필드 |
| `displayName` | 토스 앱 내에서 표시될 앱 이름(한국어 가능). | (없음, 필수 입력) |
| `primaryColor` | 브랜드 주색상. `#RRGGBB` 형식. | `#3182F6` |
| `icon` | 브랜드 아이콘 이미지 URL (https://…). 없으면 Enter로 건너뜀. | (없음, 선택) |

**`icon` 주의사항**: 빈 문자열을 전달하면 `ait build` 실행 시
`[Apps In Toss Plugin] 플러그인 옵션이 올바르지 않습니다.` 오류가 발생한다.
실제 URL을 제공하지 않으면 `icon` 키 자체를 생략한다 — 절대 빈 문자열을
`granite.config.ts`에 쓰지 않는다.

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

### 2. `granite.config.ts` 충돌 확인 (idempotency 선행 검사)

```bash
ls granite.config.ts
```

파일이 이미 있으면 **즉시 중단**한다. 덮어쓰지 않는다:

```
granite.config.ts가 이미 존재합니다. 수동 편집된 파일일 수 있으므로
덮어쓰지 않습니다.

파일 내용을 확인하고, 필요하면 직접 수정해주세요.
나머지 단계(devDependency 추가, bundle:ait 스크립트, .gitignore)는
계속 진행하려면 granite.config.ts를 잠깐 이름 변경해두거나,
각 단계를 수동으로 적용하세요.
```

### 3. 패키지 매니저 감지

```bash
ls pnpm-lock.yaml package-lock.json yarn.lock bun.lockb 2>/dev/null
```

| lockfile | 매니저 |
|---|---|
| `pnpm-lock.yaml` | pnpm |
| `package-lock.json` | npm |
| `yarn.lock` | yarn |
| `bun.lockb` | bun |
| (없음) | pnpm (기본값) |

### 4. 입력값 수집

사용자에게 순서대로 묻는다.

1. **appName**: `package.json`의 `name`을 기본값으로 제안. 사용자가 Enter를
   누르면 그대로 사용.
2. **displayName**: 기본값 없음. 비워두면 다시 묻는다.
3. **primaryColor**: 기본값 `#3182F6`. Enter 시 기본값 사용.
4. **icon URL** (선택): "브랜드 아이콘 URL을 입력하세요 (없으면 Enter로 건너뜀)".
   입력 없이 Enter → `icon` 키 생략.
   입력이 있으면 `https://`로 시작하는지 확인한다 — 아니면 다시 묻는다.

Vite 설정 자동 감지:

```bash
ls vite.config.ts vite.config.js 2>/dev/null
```

`vite.config.ts`(또는 `.js`)를 `Read`로 읽어 `server.port` 값을 추출한다.
찾으면 그 값을 `web.port`로 사용. 못 찾으면 기본값 `5173`.
`web.host`는 `localhost`, dev 명령은 `vite`, build 명령은 `vite build` 고정.

### 5. `@apps-in-toss/cli` devDependency 추가 (idempotent)

`package.json`의 `devDependencies`에 `@apps-in-toss/cli`가 있으면 skip.

```bash
grep '"@apps-in-toss/cli"' package.json
```

없으면 설치한다:

```bash
# pnpm
pnpm add -D @apps-in-toss/cli@^2.5.2

# npm
npm install --save-dev @apps-in-toss/cli@^2.5.2

# yarn
yarn add -D @apps-in-toss/cli@^2.5.2

# bun
bun add -d @apps-in-toss/cli@^2.5.2
```

### 6. `granite.config.ts` 생성

Step 2에서 파일이 없음을 이미 확인했으므로 `Write` tool로 바로 생성한다.

**`icon`을 입력한 경우** — `brand` 블록에 `icon` 포함:

```ts
import { defineConfig } from '@apps-in-toss/web-framework/config';

export default defineConfig({
  appName: '<appName>',
  brand: {
    displayName: '<displayName>',
    primaryColor: '<primaryColor>',
    icon: '<icon URL>',
  },
  web: {
    host: 'localhost',
    port: <port>,
    commands: {
      dev: 'vite',
      build: 'vite build',
    },
  },
  permissions: [],
  outdir: 'dist',
});
```

**`icon`을 입력하지 않은 경우** — `brand` 블록에서 `icon` 키 완전 생략:

```ts
import { defineConfig } from '@apps-in-toss/web-framework/config';

export default defineConfig({
  appName: '<appName>',
  brand: {
    displayName: '<displayName>',
    primaryColor: '<primaryColor>',
  },
  web: {
    host: 'localhost',
    port: <port>,
    commands: {
      dev: 'vite',
      build: 'vite build',
    },
  },
  permissions: [],
  outdir: 'dist',
});
```

`permissions: []`는 처음 빌드 통과용 placeholder다. SDK 호출에 권한 prompt가
필요한 도메인을 사용하면 이 배열에 추가한다.

### 7. `bundle:ait` 스크립트 추가 (idempotent)

`package.json`을 `Read`로 읽어 `scripts["bundle:ait"]`가 이미 있으면 skip.
없으면 `Edit` tool로 `scripts` 객체에 `"bundle:ait": "ait build"` 추가.

`Edit` tool 사용 시 기존 scripts 마지막 항목 뒤에 한 줄 삽입하는 방식으로
파일 전체를 재작성하지 않는다.

### 8. `.gitignore` 항목 추가 (idempotent)

`.gitignore`를 `Read`로 읽는다 (없으면 신설).

이미 `.granite/`와 `*.ait`가 둘 다 있으면 skip.

없는 항목만 파일 끝에 추가한다:

```
# Apps in Toss bundle artifacts
.granite/
*.ait
```

`# Apps in Toss bundle artifacts` 주석은 한 번만 추가한다. 항목이 이미 있어서
주석만 없는 경우, 주석은 생략하고 항목도 skip.

### 9. 완료 안내

```
setup-bundle 완료

변경 내용:
  - devDependencies에 @apps-in-toss/cli@^2.5.2 추가 (또는 이미 있어서 skip)
  - granite.config.ts 생성
  - package.json: scripts.bundle:ait 추가 ("ait build")
  - .gitignore: .granite/ + *.ait 추가

번들 빌드:
  pnpm bundle:ait        # ait build 실행 → <appName>.ait 생성

다음 단계:
  /ait deploy            # 번들을 앱인토스 콘솔에 업로드

참고:
  - granite.config.ts의 permissions: []는 placeholder입니다.
    SDK 권한 prompt가 필요한 API를 사용한다면 여기에 추가하세요.
  - bundle:ait 명령은 내부적으로 vite build를 한 번 더 실행합니다.
    타입 체크는 별도로 pnpm typecheck를 돌리세요.
  - 콘솔 앱 등록(aitcc app register)과 Deploy Key 발급(aitcc keys create)이
    완료되어 있어야 /ait deploy를 진행할 수 있습니다.
```

## Out of scope (이 skill이 하지 않는 것)

- ❌ 콘솔 앱 등록(`aitcc app register`) — `aitcc app init` + `aitcc app register`의 역할.
- ❌ Deploy Key 발급(`aitcc keys create`) — 운영자/maintainer 결정 필요.
- ❌ 콘솔 인증(`aitcc login`) — 별도 작업.
- ❌ 배포 업로드 — `/ait deploy` (`deploy` skill).
- ❌ 기존 `granite.config.ts` 수정 — 수동 편집 내용을 보호하기 위해 파일이 있으면 중단.
- ❌ `ait build` 실행 검증 — 설정만 추가하고 빌드 실행은 사용자에게 위임.
- ❌ `web.commands.build`를 `tsc -b && vite build`로 설정 — 번들에는 타입 체크나
  SSG/sitemap이 불필요하므로 `vite build` 단독 사용.

## 하지 말아야 할 것

- ❌ `granite.config.ts`가 이미 있으면 어떤 이유로도 덮어쓰기. 사용자 작업 보호 최우선.
- ❌ `brand.icon`에 빈 문자열(`''`) 쓰기. 스키마 검증 실패 원인. 입력 없으면 키 생략.
- ❌ `@apps-in-toss/cli`를 `dependencies`에 추가. 반드시 `devDependencies`.
- ❌ 생성되는 주석이나 메시지에 "공식(official)", "토스가 제공하는", "powered by Toss"
  등 제휴·후원·인증 암시 표현.
- ❌ idempotency 체크 없이 중복 적용 — 2회 실행 시 `granite.config.ts` 없을 때만
  새로 생성, 나머지는 각 단계별 skip 로직 적용.
- ❌ `package.json` 전체 재작성 — `Edit` tool로 최소 변경.

## 참고

- 짝 skill: `deploy` (`bundle:ait` 빌드 후 콘솔에 업로드).
- 짝 skill: `new-miniapp` (새 프로젝트 생성 — `granite.config.ts` 없는 상태에서 시작).
- sdk-example 구현 사례: https://github.com/apps-in-toss-community/sdk-example
- `@apps-in-toss/cli` (번들러 바이너리): https://www.npmjs.com/package/@apps-in-toss/cli
- 커뮤니티 docs: https://docs.aitc.dev/
