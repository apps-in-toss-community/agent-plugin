# debug-console facet — `/ait inject-debug-console` 상세

기존 앱인토스 미니앱 프로젝트에 `@ait-co/debug-console`을 설치해, on-device 디버깅
(환경 3 — intoss-private candidate)에 attach 표면을 남긴다. `/ait inject-debug-console`는
인자를 받지 않는다.

`@ait-co/debug-console`은 예전 `@ait-co/devtools`의 `./in-app` export였다 — devtools의
MCP 데몬·test runner·on-device attach 표면이 별도 repo(`debugger`)로 분리되면서
`@ait-co/debugger`(MCP 데몬, devDep/npx 전용)와 `@ait-co/debug-console`(on-device attach +
eruda) 2개 패키지로 나뉘었다.

생성·수정하는 파일에서 "공식(official)", "토스가 제공하는", "powered by Toss" 등 제휴·후원·
인증 암시 표현을 쓰지 않는다. 이 skill은 콘솔 인증을 요구하지 않는다 — 로컬 설치 작업이다.

## 보안 스코프 (중요)

`@ait-co/debug-console`은 **프로덕션 미니앱 번들에 실제로 들어갈 수 있는 유일한 디버그
패키지**다 — `@ait-co/devtools`(mock+panel+unplugin)와 `@ait-co/debugger`(MCP 데몬)는
둘 다 devDep/npx 전용이라 번들에 유입되지 않는다. 보안 스코프가 이 패키지 하나로
격리된 이유이기도 하다: 설치돼 있지 않으면 attach 코드가 번들에 구조적으로 들어갈 수
없다 — attach 표면 유무가 "설치 여부"로 결정되므로, 프로덕션에 attach 코드를 남기고
싶지 않다면 이 skill을 실행하지 않으면 된다.

## 의존

- **pnpm / npm / yarn / bun** 중 하나. 감지 순서: `pnpm-lock.yaml` → `package-lock.json` →
  `yarn.lock` → `bun.lockb`. 아무것도 없으면 `pnpm`으로 가정.
- **`package.json`이 cwd에 있어야 한다**. 없으면 프로젝트 루트로 이동하도록 안내하고 중단.
- 인터넷 연결 필요 (`@ait-co/debug-console` npm 설치).

## 1. 프로젝트 루트 확인

```bash
ls package.json
```

없으면 즉시 중단:

```
package.json이 없습니다. 프로젝트 루트 디렉토리에서 다시 실행해주세요.
예: cd <project-root> && /ait inject-debug-console
```

## 2. 이미 설치됐는지 확인 (idempotency)

`package.json`의 `dependencies`에 `@ait-co/debug-console`이 있으면 설치 단계를 건너뛴다.
있더라도 진입점 와이어업 단계(step 4)는 진행한다 — import가 누락됐을 수 있기 때문.

```bash
node -e "const p=require('./package.json'); process.exit(p.dependencies?.['@ait-co/debug-console'] ? 0 : 1)"
```

## 3. 패키지 설치

Step 2에서 이미 있으면 skip. **반드시 `dependencies`다 — `devDependencies`가 아니다**
(devtools·debugger와 달리 이 패키지만 프로덕션 번들에 실제로 들어간다):

```bash
pnpm add @ait-co/debug-console      # pnpm
npm install @ait-co/debug-console   # npm
yarn add @ait-co/debug-console      # yarn
bun add @ait-co/debug-console       # bun
```

## 4. 진입점 와이어업 (멱등)

진입점(`--entry` 없음 — `inject-polyfill`과 동일한 자동 감지 순서: `src/main.tsx` →
`src/main.ts` → `src/index.tsx` → `src/index.ts` → `index.tsx` → `index.ts`)을 `Read`로
열어 `@ait-co/debug-console`이 이미 import되어 있는지 확인. 있으면:

```
@ait-co/debug-console import가 이미 있습니다. 와이어업을 건너뜁니다.
```

없으면 진입점에 self-gating `/auto` import를 추가한다:

```ts
import '@ait-co/debug-console/auto';
```

`/auto`는 런타임 환경(예: `RELEASE_CHANNEL=dogfood` candidate)에서만 스스로 활성화되는
self-gating 진입점이다 — 일반 프로덕션 빌드나 브라우저 dev 환경에서는 no-op이다. 수동
attach 제어가 필요하면 named export를 안내한다:

```ts
import { attach } from '@ait-co/debug-console';
// 조건에 맞을 때만 명시적으로 attach
if (shouldEnableDebugConsole) attach();
```

## 5. debug-console facet 완료 seam

```
@ait-co/debug-console 설정 완료

변경 내용:
  - dependencies에 @ait-co/debug-console 추가 (또는 이미 있어서 skip)
  - <진입점 파일>에 import '@ait-co/debug-console/auto' 삽입 (또는 이미 있어서 skip)

[알아야 할 것]
  - @ait-co/debug-console은 dependencies입니다 — 프로덕션 번들에 실제로 포함되는
    유일한 디버그 패키지입니다. attach 표면을 남기고 싶지 않으면 이 skill을
    실행하지 마세요.
  - /auto는 self-gating — 일반 프로덕션/브라우저 dev에서는 no-op, candidate 빌드에서만
    활성화됩니다.
  - eruda 기반 in-app 콘솔은 attach 후 화면에서 직접 열 수 있습니다.

다음 단계:
  RELEASE_CHANNEL=dogfood ait build   # candidate 빌드에 attach 표면 포함
  /ait debug                          # 환경 3 QR attach로 on-device 디버깅

참고: https://github.com/apps-in-toss-community/debugger
```

## debug-console facet 하지 말아야 할 것

- ❌ `dependencies` 대신 `devDependencies`에 설치 — 프로덕션 번들에 포함돼야 하는
  유일한 패키지다.
- ❌ 진입점 이외 파일에 자동 import 삽입.
- ❌ `@ait-co/devtools`·`@ait-co/debugger`와 혼동 — 이 facet은 온디바이스 attach +
  eruda 전용이다. MCP 데몬 등록은 plugin manifest가 이미 처리(`/ait debug` 참조),
  브라우저 mock/panel은 `inject-devtools` facet.
- ❌ 생성·수정하는 내용에 "공식(official)", "토스가 제공하는", "powered by Toss" 등
  제휴·후원·인증 암시 표현.
