---
name: inject-devtools
description: |
  Add `@ait-co/devtools` unplugin to an existing Apps in Toss mini-app project.
  Detects the build tool (Vite / Next.js / Rspack / Webpack), installs the dev
  dep with the right package manager, and patches the config file idempotently.
  Triggered by `/ait inject-devtools`.
argument-hint: ''
---

# inject-devtools skill

## 목적

이미 `@apps-in-toss/web-framework`를 사용하는 기존 프로젝트에 `@ait-co/devtools`
unplugin을 추가해, 토스 앱 없이 브라우저에서 개발·테스트할 수 있게 한다.

`new-miniapp`이 from-scratch라면 `inject-devtools`는 **brownfield**. 기존 파일을
최소한으로 수정하고, 이미 설정이 있으면 skip한다.

생성되는 파일/주석에서 "공식(official)", "토스가 제공하는", "powered by Toss" 등 제휴·후원·인증 암시 표현을 쓰지 않는다.

## 입력

`/ait inject-devtools`는 인자를 받지 않는다.

호출 예:

```
/ait inject-devtools
```

## 의존

- **pnpm / npm / yarn / bun** 중 하나가 있어야 한다. 감지 순서: `pnpm-lock.yaml`
  → `package-lock.json` → `yarn.lock` → `bun.lockb`. 아무것도 없으면 `pnpm`으로
  가정.
- **`package.json`이 cwd에 있어야 한다**. 없으면 사용자에게 프로젝트 루트로
  이동하도록 안내하고 중단.
- 인터넷 연결 필요 (`@ait-co/devtools` npm 설치).

> 이 skill은 콘솔 인증을 **요구하지 않는다**. devtools는 로컬 dev 전용.

## 실행 순서

### 1. 프로젝트 루트 확인

```bash
ls package.json
```

없으면 즉시 중단:

```
package.json이 없습니다. 프로젝트 루트 디렉토리에서 다시 실행해주세요.
예: cd <project-root> && /ait inject-devtools
```

### 2. 빌드 도구 감지

아래 순서로 빌드 도구를 감지한다. 첫 번째로 매칭된 것을 사용.

| 우선순위 | 감지 조건 | 빌드 도구 |
|---|---|---|
| 1 | `vite.config.ts` 또는 `vite.config.js` 존재 | **Vite** |
| 2 | `next.config.ts` 또는 `next.config.js` 또는 `next.config.mjs` 존재 | **Next.js** |
| 3 | `rspack.config.ts` 또는 `rspack.config.js` 존재 | **Rspack** |
| 4 | `webpack.config.ts` 또는 `webpack.config.js` 존재 | **Webpack** |

```bash
ls vite.config.ts vite.config.js next.config.ts next.config.js next.config.mjs \
   rspack.config.ts rspack.config.js webpack.config.ts webpack.config.js 2>/dev/null
```

감지 실패(어느 파일도 없음)이면:

```
빌드 도구를 감지하지 못했습니다.
현재 지원: Vite, Next.js, Rspack, Webpack.
config 파일(예: vite.config.ts)이 프로젝트 루트에 있어야 합니다.
```

중단하고 사용자가 빌드 도구를 알려주면 수동 가이드를 진행한다.

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

### 4. 이미 설치됐는지 확인 (idempotency)

`package.json`의 `devDependencies`에 `@ait-co/devtools`가 있으면 설치 단계를
건너뛴다. 있더라도 config 패치 단계(step 5)는 진행한다 — config가 누락됐을 수
있기 때문.

```bash
grep '"@ait-co/devtools"' package.json
```

### 5. 패키지 설치

Step 4에서 이미 있으면 skip.

```bash
# pnpm
pnpm add -D @ait-co/devtools

# npm
npm install --save-dev @ait-co/devtools

# yarn
yarn add -D @ait-co/devtools

# bun
bun add -d @ait-co/devtools
```

설치 시 `unmet peer react-native` 경고가 나올 수 있다 — **무시해도 된다**. 웹
미니앱은 RN을 쓰지 않고, devtools가 dev 시점에 SDK를 mock으로 대체하기 때문.

### 6. config 파일 패치 (idempotency)

config 파일을 **Read** tool로 읽어 내용 전체를 파악한 뒤, `@ait-co/devtools/unplugin`
import와 plugin 등록이 이미 있으면 skip. 없으면 최소 변경으로 추가.

**idempotency 체크**: config 파일에 `@ait-co/devtools` 문자열이 있으면 skip:

```
이미 @ait-co/devtools 설정이 있습니다. 설정 파일을 확인하고 필요하면 수동으로
조정하세요.
```

#### Vite (`vite.config.ts` / `vite.config.js`)

import를 파일 맨 위 기존 import 블록 끝에 추가하고, `plugins` 배열에 `aitDevtools.vite()`를 추가한다.

**패턴: `plugins` 배열이 이미 있는 경우**

```ts
// 추가 전
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
});

// 추가 후
import aitDevtools from '@ait-co/devtools/unplugin';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), aitDevtools.vite()],
});
```

**패턴: `plugins`가 없는 경우** — `defineConfig({})` 객체에 `plugins` 키를 추가:

```ts
export default defineConfig({
  plugins: [aitDevtools.vite()],
  // 기존 키들 유지
});
```

**Vite 8 주의 (rolldown)**: `vite.config.ts`가 `"type": "module"` ESM 환경이고
`@apps-in-toss/web-framework` alias를 `resolve.alias`로 직접 걸어두는 프로젝트는
plugin의 `mock: false`로 두는 게 안전하다. 단, 이 경우는 고급 설정이므로 일반
사용자에게는 기본값(`aitDevtools.vite()`)을 권장하고, 문제가 생기면 수동 조정을
안내한다.

#### Next.js (`next.config.ts` / `next.config.js` / `next.config.mjs`)

Next.js는 `webpack()` 플러그인을 사용한다. `config.plugins` 배열에 push하는
패턴을 따른다.

**패턴: `webpack` 함수가 이미 있는 경우** — 기존 함수 끝에 push 추가:

```ts
import aitDevtools from '@ait-co/devtools/unplugin';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  webpack(config) {
    config.plugins.push(aitDevtools.webpack());
    return config;
  },
};
export default nextConfig;
```

**패턴: `webpack` 함수가 없는 경우** — `nextConfig` 객체에 `webpack` 키 추가:

```ts
import aitDevtools from '@ait-co/devtools/unplugin';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // 기존 설정 유지
  webpack(config) {
    config.plugins.push(aitDevtools.webpack());
    return config;
  },
};
export default nextConfig;
```

#### Rspack (`rspack.config.ts` / `rspack.config.js`)

```ts
import aitDevtools from '@ait-co/devtools/unplugin';

export default {
  // 기존 설정 유지
  plugins: [aitDevtools.rspack()],
};
```

#### Webpack (`webpack.config.ts` / `webpack.config.js`)

```ts
import aitDevtools from '@ait-co/devtools/unplugin';

module.exports = {
  // 기존 설정 유지
  plugins: [aitDevtools.webpack()],
};
```

**config 파일 수정 원칙**:
- `Edit` tool로 최소 변경. 기존 코드 포맷·주석·설정은 유지.
- `aitDevtools.vite()`는 인수 없이 쓴다 (실기기 미리보기 tunnel이 필요하면
  `/ait setup-phone-preview`가 별도로 `tunnel` 옵션을 설정).
- `production` 빌드에서는 unplugin이 자동으로 비활성화된다(`NODE_ENV=production`
  감지). 빌드 결과물에 mock이 포함되지 않으므로 추가 조건 분기는 불필요.

### 7. 다음 단계 안내

완료 메시지를 한 블록으로 출력:

```
@ait-co/devtools 설정 완료

변경 내용:
  - devDependencies에 @ait-co/devtools 추가 (또는 이미 있어서 skip)
  - <config-file>에 unplugin 설정 추가 (또는 이미 있어서 skip)

다음 단계:
  pnpm dev                  # (또는 npm run dev / yarn dev / bun dev)
  /ait debug                # 브라우저 패널·window.__ait 상태로 디버깅
  /ait setup-phone-preview  # (선택) 실기기에서 dev 앱 미리보기

브라우저에서 앱을 열면 하단에 AIT DevTools 패널이 나타납니다.
패널에서 mock 상태(권한, 위치, IAP 등)를 실시간으로 제어할 수 있습니다.

참고:
  - 패널이 보이지 않으면 진입점(main.ts / index.ts)에 아래를 추가하세요:
      import '@ait-co/devtools/panel';
  - devtools는 NODE_ENV=development 에서만 활성화됩니다 (production 빌드엔 미포함).
  - 문서: https://github.com/apps-in-toss-community/devtools
  - 커뮤니티: https://aitc.dev/
```

## Out of scope (이 skill이 하지 않는 것)

- ❌ `@ait-co/devtools`를 이미 포함하는 새 프로젝트 생성 — `/ait new` (`new-miniapp` skill).
- ❌ `@ait-co/polyfill` 설정 — `/ait inject-polyfill` (`inject-polyfill` skill).
- ❌ 콘솔 인증·배포 — `/ait deploy` (`deploy` skill).
- ❌ panel 마운트 검증 (E2E 브라우저 자동화) — 사용자가 직접 `pnpm dev`로 확인.
- ❌ devtools를 Rollup/esbuild 라이브러리 빌드에 주입 — 앱(미니앱) 전용.
  라이브러리 빌드에 mock이 포함되면 안 된다.

## 하지 말아야 할 것

- ❌ config 파일을 완전히 재작성. **최소 변경 only** (`Edit` tool 사용).
- ❌ `devDependencies`에서 `dependencies`로 옮기기. devtools는 반드시 `devDependencies`.
- ❌ `production` 모드 강제 활성화(`forceEnable: true`) — 빌드 산출물에 mock이
  포함되어 앱 스토어 심사에서 문제가 될 수 있다.
- ❌ `@ait-co/devtools` 외의 다른 패키지 설치·변경.
- ❌ 생성되는 주석이나 메시지에 "공식(official)", "토스가 제공하는", "powered by Toss"
  등 제휴·후원·인증 암시 표현. 커뮤니티 오픈소스 도구다.

## 참고

- 짝 skill: `new-miniapp` (새 프로젝트 생성), `inject-polyfill` (polyfill 마이그레이션), `deploy`.
- devtools API / 지원 번들러 상세: https://github.com/apps-in-toss-community/devtools
- devtools live demo: https://devtools.aitc.dev/
- 커뮤니티 docs: https://docs.aitc.dev/
