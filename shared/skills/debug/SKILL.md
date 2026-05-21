---
name: debug
description: |
  Help debug an Apps in Toss mini-app. Today this guides you through the
  in-browser tools that ship now — the `@ait-co/devtools` floating panel
  (mock state, 12 tabs), the `window.__ait` runtime state object, and the
  browser's own DevTools (console / network). On-device debugging of a
  production `.ait` bundle (CDP relay MCP) is a separate surface that ships in
  `@ait-co/devtools` and is described at the end as the next step, not invoked
  here. Triggered by `/ait debug`.
argument-hint: ''
---

# debug skill

## 목적

`/ait debug`는 미니앱을 디버깅하는 가장 빠른 경로를 안내한다. 지금 바로 쓸 수
있는 것은 **브라우저 안에서의 디버깅**이다:

- `@ait-co/devtools`의 floating panel — mock 상태(권한·위치·IAP·이벤트 등)를
  실시간 관찰·조작 (12개 탭).
- `window.__ait` — 런타임 SDK mock 상태 객체. 콘솔이나 에이전트가 직접 읽는다.
- 브라우저 기본 DevTools — console / network / sources.

토스 앱 WebView 안에서 도는 **production `.ait` 번들**을 폰에서 직접 디버깅하는
on-device 경로(CDP relay 기반)는 `@ait-co/devtools`에 들어와 있는 별도 surface다 —
이 skill 끝의 "다음 단계"에서 안내만 하고, 여기서 실행하지는 않는다.

생성·수정하는 모든 메시지에서 "공식(official)", "토스가 제공하는",
"powered by Toss" 등 제휴·후원·인증 암시 표현을 쓰지 않는다.

## 의존

- **`@ait-co/devtools`가 devDependencies에 있어야** floating panel을 쓸 수 있다.
  없으면 `/ait inject-devtools`를 먼저 안내한다 (없어도 브라우저 기본 DevTools
  가이드는 진행 가능).
- **`package.json`이 cwd에 있어야 한다**. 없으면 프로젝트 루트로 이동 안내.
- 브라우저에서 `pnpm dev`(또는 동등 명령)로 앱이 떠 있는 상태를 가정한다.

> 이 skill은 콘솔 인증을 요구하지 않는다. 브라우저 디버깅은 로컬 전용.

## 입력

`/ait debug`는 인자를 받지 않는다. 사용자가 증상을 자연어로 설명하면 (예: "로그인
버튼을 눌러도 authorizationCode가 안 옴", "swipe로 뒤로 가면 앱이 종료됨") 그
증상에 맞는 관찰 지점을 골라 안내한다.

## 실행 순서

### 1. 환경 확인

```bash
ls package.json
```

없으면 중단:

```
package.json이 없습니다. 프로젝트 루트 디렉토리에서 다시 실행해주세요.
예: cd <project-root> && /ait debug
```

`package.json`을 `Read`로 읽어 `@ait-co/devtools`가 `devDependencies`에 있는지
확인한다.

- **있으면**: floating panel 경로(아래 2-A)를 우선 안내.
- **없으면**: 브라우저 기본 DevTools 경로(2-B)만 안내하고, panel을 원하면
  `/ait inject-devtools`를 먼저 실행하라고 덧붙인다.

### 2-A. devtools floating panel로 mock 상태 관찰

`pnpm dev`로 앱을 띄우고 브라우저에서 연다. 화면 하단의 **AIT** 버튼을 누르면
패널이 열린다. 증상별로 볼 탭:

| 증상 | 탭 | 확인할 것 |
|---|---|---|
| 권한 dialog/거부 동작 | Permissions | 권한 grant/deny 토글, 거부 시 앱 분기 |
| 위치 관련 | Location | mock 좌표 주입 후 앱 반응 |
| 결제 / 인앱구매 | IAP | 상품 mock, 구매 성공/실패 시뮬 |
| 광고 | Ads | 로드/노출/보상 콜백 |
| 뒤로가기 / 홈 / lifecycle | Events | Trigger Back/Home → 앱이 이벤트를 받는지 |
| 분석 이벤트 | Analytics | `logEvent` 호출 로그 |
| 스토리지 | Storage | setItem/getItem 왕복 (`__ait_storage:` prefix) |
| device API 모드 | Device / Environment | mock / web / prompt 모드 전환 |
| 모바일 뷰포트 | Viewport | iPhone/Galaxy 프리셋 + orientation |

패널이 안 보이면 진입점(`main.ts`/`index.ts`)에 아래가 있는지 확인:

```ts
import '@ait-co/devtools/panel';
```

(unplugin이 자동 주입하지만, rolldown/Vite 8 환경에서는 명시 import이 안전.)

### 2-B. 브라우저 기본 DevTools

panel 유무와 무관하게 항상 가능한 관찰:

- **Console**: 앱 코드의 `console.*` 출력, 던져진 예외 스택. devtools mock은
  미구현 SDK API 접근 시 **throw**하므로(잘 되는 척 방지), "devtools에선 되는데
  실 SDK에선 안 됨"이 아니라 미구현 mock이 원인이면 여기서 명확한 에러가 뜬다.
- **Network**: SDK가 호출하는 fetch/XHR, oidc-bridge auth 왕복 등.
- **Sources**: breakpoint, source map.

### 3. `window.__ait` 런타임 상태 직접 읽기

devtools mock은 상태를 `window.__ait`(AitStateManager)에 보관한다. 브라우저
콘솔에서 직접 들여다보면 패널을 열지 않고도 현재 mock 상태를 확인할 수 있다:

```js
window.__ait              // 상태 매니저 전체
window.__ait?.getState?.()  // 스냅샷 (메서드명은 버전에 따라 다를 수 있음 — 객체를 펼쳐 확인)
```

증상을 코드로 재현·검증할 때, 에이전트는 Playwright MCP가 연결돼 있으면
`browser_evaluate`로 위 값을 읽어 가설을 검증할 수 있다. (이 skill 자체가
브라우저를 띄우지는 않는다 — 사용자가 이미 띄운 dev 서버를 가정.)

### 4. 증상 → 가설 → 관찰 지점 정리

수집한 정보를 바탕으로 에이전트가 가설을 세우고, 위 관찰 지점 중 어디서 검증할지
한 블록으로 제시한다. 예:

```
증상: swipe로 뒤로 가면 앱이 종료됨
가설: BrowserRouter의 history.length === 1이라 native swipe가 미니앱 종료로 빠짐
관찰: 브라우저 콘솔에서 `window.history.length` 확인 → 메뉴 진입 후에도 1이면 가설 성립
검증: 라우팅을 history depth가 쌓이는 구조로 바꾸거나 swipe gesture 비활성화 후 재현
```

## 다음 단계: production 번들 on-device 디버깅

브라우저 디버깅은 **dev 번들**(mock + panel)에만 적용된다. 토스 앱 WebView 안에서
도는 **production `.ait` 번들**은 mock도 panel도 없어 디버깅 surface가 0이다.
폰에서만 재현되는 회귀(예: native swipe-back)를 에이전트가 단독으로 진단·검증할 수
있도록, CDP(Chrome DevTools Protocol) relay 기반 on-device debug surface가
`@ait-co/devtools`에 들어와 있다.

핵심 형태:

- production 번들에 CDP 구현(Chii)을 동적 import로 부착하고, 얇은 MCP 서버가 그
  WebSocket을 `chrome-devtools-mcp` 호환 tool로 wrap → 에이전트가 폰 안 번들의
  history/console/network/DOM을 read. MCP 서버는 `devtools-mcp` bin으로 실행한다.
- **3-layer activation gate**로 일반 사용자에겐 완전히 부재: build-time
  (`__DEBUG_BUILD__` dead-code elimination) + runtime entry(`_deploymentId`) +
  명시 opt-in(`?debug=1&relay=<wss-url>`). 셋을 모두 통과해야 attach.

gate 판정(`@ait-co/devtools/in-app`의 `evaluateDebugGate`), relay transport,
MCP 서버(`@ait-co/devtools/mcp`)는 모두 `@ait-co/devtools@0.1.23`에 publish됐고
sdk-example에 dog-food 배선까지 들어가 있다. 남은 것은 실기기 acceptance 1회다.
on-device 경로가 acceptance까지 끝나면 이 skill이 그 흐름까지 직접 안내하도록
확장한다.

## Out of scope (이 skill이 하지 않는 것)

- ❌ 브라우저를 직접 띄우기 — 사용자가 `pnpm dev`로 띄운 환경을 가정.
- ❌ production 번들 on-device 디버깅 실행 — 위 "다음 단계"는 안내만, 실행 안 함.
- ❌ devtools 설정 주입 — `/ait inject-devtools`.
- ❌ 콘솔 인증·배포·앱 등록 — `/ait deploy`, `/ait register`, `/ait status`.
- ❌ 코드 자동 수정 — 관찰·진단을 돕고, 수정은 에이전트의 일반 편집 흐름으로.

## 하지 말아야 할 것

- ❌ on-device debug 경로가 실기기에서 "검증 완료"라고 단정. surface는 publish됐지만
  실기기 acceptance가 남아 있다 — `/ait debug`가 지금 바로 안내하는 건 브라우저 디버깅이다.
- ❌ `window.__ait`의 메서드명을 고정으로 단정. 버전에 따라 다를 수 있으니 객체를
  펼쳐 확인하도록 안내.
- ❌ 미구현 mock의 throw를 "버그"로 오인. 의도된 동작이며 누락 API는 devtools
  이슈로 보고 안내.
- ❌ 메시지에 "공식(official)", "토스가 제공하는", "powered by Toss" 등
  제휴·후원·인증 암시 표현.

## 참고

- 짝 skill: `inject-devtools` (panel 설정), `setup-phone-preview` (실기기 미리보기 tunnel).
- devtools (mock + panel): https://github.com/apps-in-toss-community/devtools
- devtools live demo: https://devtools.aitc.dev/
- on-device debug (CDP relay MCP): `@ait-co/devtools` `./in-app` + `./mcp` + `devtools-mcp` bin (0.1.23+). 설계: devtools repo `docs/superpowers/specs/2026-05-18-in-app-debug-mcp.md`
- 커뮤니티 docs: https://docs.aitc.dev/
