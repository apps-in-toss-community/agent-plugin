---
name: inject-polyfill
description: |
  Migrate an existing Apps in Toss mini-app project to `@ait-co/polyfill` mode —
  install the package, wire up the auto-import in the entry point, and guide the
  developer on writing standard Web API calls that route through the SDK at runtime.
  Triggered by `/ait inject-polyfill`.
argument-hint: '[--entry <path>]'
---

# inject-polyfill skill

## 목적

기존 앱인토스 미니앱 프로젝트에 `@ait-co/polyfill`을 도입해, 앱 코드가 SDK를 직접
호출하지 않고 **표준 Web API** (`navigator.clipboard`, `navigator.geolocation` 등)를
그대로 써도 런타임에 SDK로 라우팅되도록 환경을 준비한다.

이 skill이 완료된 뒤 개발자는:

- `navigator.clipboard.writeText(...)` 같은 표준 코드를 **그대로** 쓸 수 있다.
- 앱인토스 WebView 안에서는 polyfill이 런타임에 자동으로 SDK 호출로 변환한다.
- 로컬 브라우저 개발 시에는 polyfill이 개입 없이 브라우저 원본 API를 사용한다.
  (`@ait-co/devtools`와 함께 쓰면 mock SDK를 경유해 동작 확인도 가능.)

생성·수정하는 모든 파일에서 "공식(official)", "토스가 제공하는", "powered by Toss" 등 제휴·후원·인증 암시 표현을 쓰지 않는다.

## 입력

- `--entry <path>` (선택): 진입점 파일 경로 (기본값: 자동 감지). 자동 감지가
  실패하면 사용자에게 묻는다.

호출 예:

```
/ait inject-polyfill
/ait inject-polyfill --entry src/index.tsx
```

## 의존

- **`pnpm` 10+, Node 24+** 가 있어야 install이 통과한다.
- `@ait-co/polyfill`은 npm에 배포되어 있다. 인터넷 필요.
- `@apps-in-toss/web-framework`는 optional peer dep — 없어도 polyfill이 설치되고
  동작하지만, 토스 WebView 안에서는 SDK가 있어야 shim이 활성화된다.

## 실행 순서

### 1. 현재 프로젝트 검증

cwd에 `package.json`이 있는지 확인:

```bash
ls package.json
```

없으면:

```
package.json을 찾을 수 없습니다. 프로젝트 루트 디렉토리에서 실행해주세요.
```

중단.

`@ait-co/polyfill`이 이미 `dependencies`에 있으면 멱등(idempotent) 처리:

```bash
node -e "const p=require('./package.json'); process.exit(p.dependencies?.['@ait-co/polyfill'] ? 0 : 1)"
```

이미 있으면:

```
@ait-co/polyfill이 이미 dependencies에 있습니다. 진입점 와이어업만 확인합니다.
```

Step 3(진입점 와이어업)으로 건너뛴다.

### 2. 패키지 설치

`@ait-co/polyfill`은 **runtime dependency** (dev가 아님):

```bash
pnpm add @ait-co/polyfill
```

설치 중 SDK peer dep 경고(`unmet peer @apps-in-toss/web-framework`)가 나타날 수
있다. 이는 정상 — polyfill은 토스 WebView 안에서는 SDK가 ambient하게 제공되므로
peer를 직접 install할 필요가 없다. 사용자에게 한 줄로 안내:

```
SDK peer 경고는 무시해도 됩니다 — 앱인토스 WebView가 SDK를 ambient하게 제공합니다.
```

### 3. 진입점 파일 감지

`--entry`가 명시됐으면 그 경로 사용. 없으면 순서대로 탐색:

1. `src/main.tsx`
2. `src/main.ts`
3. `src/index.tsx`
4. `src/index.ts`
5. `index.tsx`
6. `index.ts`

첫 번째로 존재하는 파일을 사용. 모두 없으면 사용자에게 묻는다:

```
진입점 파일을 찾을 수 없습니다. 다음 중 어느 파일이 앱의 진입점인가요?
(예: src/main.tsx, src/index.ts)
```

사용자가 답하면 그 경로로 계속.

### 4. 진입점 와이어업 (멱등)

진입점 파일을 `Read`로 열어 `@ait-co/polyfill`이 이미 import되어 있는지 확인:

- `import '@ait-co/polyfill/auto'` 또는
- `import { install } from '@ait-co/polyfill'`

둘 중 하나라도 있으면:

```
@ait-co/polyfill import가 이미 있습니다. 와이어업을 건너뜁니다.
```

없으면 **파일의 맨 첫 줄**에 다음을 삽입:

```ts
import '@ait-co/polyfill/auto';
```

삽입 위치: 파일 최상단. 이유: polyfill이 **다른 어떤 앱 코드보다 먼저** 실행되어야
shim이 첫 API 호출 전에 준비된다.

삽입 방법: `Edit` tool, `old_string`은 파일 현재 첫 줄, `new_string`은
`import '@ait-co/polyfill/auto';\n` + 기존 첫 줄. 정확한 현재 내용을 Read로 먼저
확인한 뒤 Edit 호출.

> **`/auto` 진입점 선택 이유**:
> `import '@ait-co/polyfill/auto'`는 모듈 평가 시점에 `install()`을 fire-and-forget
> 으로 실행한다. 미니앱에서 shimmed API는 항상 이벤트 핸들러·async action에서
> 사용되므로, 첫 마이크로태스크 전에 shim이 준비된다. 모듈 평가 시점에 즉시 API를
> 호출하는 특수 케이스라면 아래 명시적 형식을 안내한다.

명시적 형식이 필요한 경우를 사용자에게 함께 안내:

```ts
// 모듈 평가 시점에 즉시 shimmed API를 사용해야 하는 경우
import { install } from '@ait-co/polyfill';
const restore = await install();
```

### 5. README / 가이드 단락 추가

프로젝트 루트의 `README.md`가 있으면, 파일 끝에 다음 단락을 추가한다. 없으면
건너뛴다(README 생성은 이 skill의 책임이 아님).

이미 `@ait-co/polyfill` 관련 단락이 있으면 추가하지 않는다.

추가할 단락:

````markdown
## Polyfill (표준 Web API → Apps in Toss SDK)

이 프로젝트는 [`@ait-co/polyfill`](https://github.com/apps-in-toss-community/polyfill)을 사용합니다.
앱인토스 WebView 안에서 표준 Web API 호출이 자동으로 SDK로 라우팅됩니다.

### 지원 API (Tier 1)

| 표준 Web API | SDK 매핑 |
|---|---|
| `navigator.clipboard.writeText` / `readText` | `setClipboardText` / `getClipboardText` |
| `navigator.geolocation.getCurrentPosition` | `getCurrentLocation` |
| `navigator.geolocation.watchPosition` | `startUpdateLocation` |
| `navigator.share` | `share` |
| `navigator.vibrate` | `generateHapticFeedback` (best-effort) |
| `navigator.onLine` / `navigator.connection` | `getNetworkStatus` |
| `window.open(..., '_blank')` | `openURL` (limited — no popup Window) |

### SDK 직접 호출 코드 마이그레이션

기존 코드에서 SDK를 직접 호출하는 부분은 표준 API로 교체하면 polyfill이 처리합니다.

```ts
// Before
import { setClipboardText } from '@apps-in-toss/web-framework';
await setClipboardText('hello');

// After (polyfill이 자동 처리)
await navigator.clipboard.writeText('hello');
```

자세한 내용: <https://github.com/apps-in-toss-community/polyfill>
````

### 6. Tier-1 SDK 직접 호출 코드 자동 변환 (에이전트 Grep+Edit)

에이전트가 `@apps-in-toss/web-framework`에서 Tier-1 API를 직접 import하는 코드를
Grep으로 찾아 표준 Web API로 자동 변환한다. Tier-1 외 API(IAP, Auth, Payments 등)는
표준 Web API에 대응이 없으므로 수동 유지한다.

**Tier-1 자동 변환 대상 (에이전트가 Grep+Edit으로 처리)**

```
Tier-1 매핑:
  setClipboardText / getClipboardText  →  navigator.clipboard.writeText / readText
  getCurrentLocation                   →  navigator.geolocation.getCurrentPosition
  startUpdateLocation                  →  navigator.geolocation.watchPosition
  share                                →  navigator.share
  generateHapticFeedback               →  navigator.vibrate (best-effort)
  getNetworkStatus                     →  navigator.onLine / navigator.connection
  openURL                              →  window.open('...', '_blank')
```

**실행 순서**:

1. Tier-1 함수명을 import하는 파일을 Grep으로 탐색:

   ```bash
   grep -rn "from '@apps-in-toss/web-framework'" src/ --include="*.ts" --include="*.tsx"
   ```

2. 결과 파일을 하나씩 Read한 뒤, Tier-1 import/호출 패턴을 Edit으로 표준 API로 교체한다.

   예 (clipboard):

   ```ts
   // Before
   import { setClipboardText } from '@apps-in-toss/web-framework';
   await setClipboardText('hello');

   // After (polyfill이 자동 처리)
   await navigator.clipboard.writeText('hello');
   ```

   해당 파일에서 `@apps-in-toss/web-framework` import 행이 Tier-1 심볼만 갖고 있었다면
   그 import 행 전체를 제거한다. 다른 심볼(IAP, Auth 등)과 공존하면 Tier-1 심볼만
   import 목록에서 제거한다.

3. Tier-1 외 심볼(`signIn`, `purchase`, 각종 IAP/Payment API 등)이 남아 있는 파일은
   해당 줄을 열거하고 다음을 출력한다:

   ```
   polyfill 대상 아님 — SDK import 유지:
     <파일>:<줄>  import { <심볼> } from '@apps-in-toss/web-framework'
   ```

4. 변환 완료 후 요약을 출력한다:

```
@ait-co/polyfill 설정 완료

[완료된 것]
  - @ait-co/polyfill dependencies에 추가됨
  - <진입점 파일> 맨 위에 `import '@ait-co/polyfill/auto'` 삽입
  - Tier-1 SDK 직접 호출 → 표준 Web API 자동 변환 (에이전트 Grep+Edit)

[폴리필 대상 아님 — SDK import 유지]
  (해당 없으면 이 섹션 생략)
  <파일>:<줄>  IAP / Auth / Payments 등 Toss-specific API

[알아야 할 것]
  - @ait-co/polyfill/auto는 앱인토스 WebView에서만 shim 활성화.
    일반 브라우저에서는 브라우저 native API를 그대로 사용.
  - @ait-co/devtools와 함께 쓰면 브라우저에서도 mock SDK를 경유해 Tier 1 API
    동작을 확인할 수 있습니다.
  - vibrate는 best-effort — 완전한 ms 단위 패턴 재현 불가.
  - window.open 반환 Window는 noop stub (closed: true) — window driving 불가.
  - SDK 직접 호출(IAP, Auth, Payments 등)은 polyfill 대상이 아닙니다.
    표준 Web API에 대응이 없는 Toss-specific API는 계속 SDK에서 직접 import.

[다음 단계]
  pnpm dev              # 표준 API 경로가 동작하는지 브라우저에서 확인
  /ait inject-devtools  # (권장) devtools와 함께 쓰면 브라우저에서도 mock SDK 경유 확인
  /ait setup-bundle     # 배포 준비가 되면 .ait 번들 환경 구성

참고: https://github.com/apps-in-toss-community/polyfill
```

## Out of scope (이 skill이 하지 않는 것)

- 에이전트가 Tier-1 Grep+Edit 자동 변환 수행; Tier-1 외 API는 수동 유지.
- ❌ `@ait-co/devtools` 설치 / `vite.config.ts` 수정 — `/ait inject-devtools` skill.
- ❌ `@apps-in-toss/web-framework` 제거 — polyfill은 peer dep으로 optional하게
  공존한다. 제거 여부는 소비자가 결정.
- ❌ 콘솔 인증 / 배포 — 별도 skill.
- ❌ 빌드 설정 변경 — polyfill은 runtime-only, Vite plugin 없음. `vite.config.ts`
  수정 불필요.
- ❌ Auth / IAP / Payments / Toss-specific API — polyfill 대상 아님.

## 하지 말아야 할 것

- ❌ 진입점 이외 파일에 자동으로 import 삽입 (컴포넌트 파일 등). 진입점 1곳만.
- ❌ `/auto` 대신 `import { install } from '@ait-co/polyfill'`을 삽입하고
  `await install()` 호출을 추가 — 동기 코드 흐름을 바꿀 수 있어 위험. `/auto`가
  기본값.
- ❌ 이미 있는 import가 있으면 중복 삽입.
- ❌ README 없는 프로젝트에 README 생성.
- ❌ "공식(official)", "토스가 제공하는", "powered by Toss" 등 제휴 암시 표현.
- ❌ 파일 전체 재작성 — 삽입은 최소한으로. 기존 내용 손상 금지.

## 참고

- 짝 skill: `inject-devtools` (devtools unplugin 추가 — 함께 쓰면 브라우저에서도 표준 API 경로로 동작 확인), `new-miniapp` (polyfill 포함 템플릿 `react-vite-polyfill` 추가 예정), `deploy` (설정 완료 후 콘솔 배포).
- `@ait-co/polyfill` 패키지: <https://github.com/apps-in-toss-community/polyfill>
- 통합 가이드: [`polyfill/INTEGRATION.md`](https://github.com/apps-in-toss-community/polyfill/blob/main/INTEGRATION.md)
- 지원 API 전체 표: [`polyfill/README.md#supported-apis`](https://github.com/apps-in-toss-community/polyfill/blob/main/README.md#supported-apis)
