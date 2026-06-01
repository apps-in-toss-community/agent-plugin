---
name: debug
description: |
  Help debug an Apps in Toss mini-app across four environments. Environment 1
  (local browser): the `@ait-co/devtools` floating panel (mock state, 12 tabs),
  the `window.__ait` runtime state object, and the browser's own DevTools
  (console / network). Environment 2 (AITC Sandbox PWA): real-device WebKit
  engine via an installable PWA (`devtools.aitc.dev/launcher/`) and cloudflared
  tunnel — no Toss WebView or app review required; set up via
  `/ait setup-phone-preview`, NOT this skill's MCP attach. Environments 3/4
  (on-device intoss-private candidate / live bundle): the `ait-devtools` MCP
  server — registered by this plugin and always running — call
  `start_debug({mode})` to switch the active environment at runtime without
  restarting the server, then issue a QR attach URL via `build_attach_url`;
  once the phone scans it and the relay attaches, attach-dependent tools
  register dynamically in the same session. `/ait debug` branches by what it
  observes and prints the right path. Triggered by `/ait debug`.
argument-hint: ''
---

# debug skill

## 목적

`/ait debug`는 미니앱을 **네 겹의 환경**에서 디버깅하는 경로를 안내한다. 한 명령이
관찰 결과에 따라 환경을 분기한다 (umbrella `CLAUDE.md` §1.1 환경 4겹 모델):

| 환경 | 실행 면 | 이 skill의 경로 |
|---|---|---|
| 1. 로컬 브라우저 | desktop Chromium + mock SDK + Panel | 2-A/2-B/3 — panel · `window.__ait` · 브라우저 DevTools |
| 2. AITC Sandbox PWA | 실기기 Safari/WebKit + installable PWA(`devtools.aitc.dev/launcher/`) + cloudflared 터널 | → `/ait setup-phone-preview`(이 skill 범위 밖, 실기기 WebKit dev 미리보기) |
| 3. intoss-private relay dev | 실기기 토스 앱 WebView(dogfood) + CDP relay | 5 — `start_debug({mode:'relay-dev'})` → `build_attach_url` QR attach |
| 4. intoss live relay debug | 실기기 토스 앱 WebView(LIVE, 검수 통과) + CDP relay | 5 — `start_debug({mode:'relay-live', confirm:true})` → `build_attach_url` QR (read-only) |

- **환경 1**은 지금 바로, 의존 없이 쓴다:
  - `@ait-co/devtools`의 floating panel — mock 상태(권한·위치·IAP·이벤트 등)를
    실시간 관찰·조작 (12개 탭).
  - `window.__ait` — 런타임 SDK mock 상태 객체. 콘솔이나 에이전트가 직접 읽는다.
  - 브라우저 기본 DevTools — console / network / sources.
- **환경 3·4**는 `ait-devtools` MCP 서버로 닿는다. 이 서버는 plugin이 manifest에
  등록해 **상시 기동**되므로, `/ait debug`는 새 서버를 띄우지 않고 **`start_debug({mode})`로
  runtime 환경을 설정한 뒤 attach 경로를 발급**한다(아래 5). attach 전에는 bootstrap 도구
  (`start_debug`·`build_attach_url`·`list_pages`·`get_diagnostics`)만 보이고, 폰이
  relay에 붙으면 나머지 도구가 같은 세션에서 동적 등록된다.

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

## 5. on-device 디버깅 (환경 3·4) — MCP attach

브라우저 디버깅(1~4)은 **dev 번들**(mock + panel)에만 적용된다. 토스 앱 WebView
안에서 도는 **`.ait` 번들**은 mock도 panel도 없어, 폰에서만 재현되는 회귀(예:
native swipe-back)는 CDP(Chrome DevTools Protocol) relay로 attach해야 관측된다.
이 경로는 `ait-devtools` MCP 서버가 담당한다 — plugin manifest의 `mcpServers`에
등록돼 **상시 기동**되므로(`/mcp`에 `ait-devtools`로 뜬다), 이 skill은 새 서버를
띄우지 않고 attach 경로만 발급한다.

> **환경 2(AITC Sandbox PWA)에 대해**: 이 §5의 MCP attach 경로는 환경 3·4(토스 앱
> WebView)에만 적용된다. 환경 2는 토스 앱·검수 없이 실기기 WebKit 엔진을 볼 수 있는
> 중간 fidelity 겹으로, `/ait setup-phone-preview`가 cloudflared 터널 + PWA로
> 배선한다 — 이 skill이 아니다. "실기기인데 §5에 없다"면 환경 2 경로를 의심할 것.

### 5-A. 환경 분기

폰 디버깅은 두 환경 중 하나다. 사용자가 어느 번들을 보는지로 가른다:

- **환경 3 (intoss-private candidate)** — `ait build` + `aitcc app deploy`로
  업로드한 `intoss-private://…?_deploymentId=<uuid>` candidate.
  PREPARE 상태에서도 cold-load된다. 출시 전 실기기 개발 루프.
- **환경 4 (intoss live)** — 검수를 통과해 LIVE인 번들(`intoss://…`). 동일 relay로
  붙되 **read-only 관측**만. 검수 큐 제출(비가역)은 이 skill의 범위가 아니다.

candidate scheme URL이 없으면 먼저 station 5(`/ait setup-bundle` → `/ait register`
→ `/ait deploy`)로 candidate를 만들도록 안내한다.

#### `start_debug(mode)` — 런타임 환경 전환 (정본 진입 경로)

`ait-devtools` 데몬은 **상시 기동** 상태로, 환경 진입은 **서버 재구동 없이** MCP 도구
`start_debug({mode})`를 호출해 런타임에 결정한다. 한 데몬이 local(환경 1) + relay(환경
3·4) connection을 동시에 보유하며, `start_debug`가 어느 connection을 active로 쓸지
**warm attach를 유지한 채** 즉시 전환한다. 한 세션에서 환경 1→3→1 사이를 자유롭게
오갈 수 있다(Claude Code 재구동·MCP 재핸드셰이크 불필요).

| `mode` 값 | 환경 | 특이사항 |
|---|---|---|
| `local-browser-dev` | 환경 1 — mock Chromium panel | 기본값, relay 불필요 |
| `local-browser-cdp` | 환경 1 — 브라우저 CDP 직접 연결 | Chrome remote debugging 포트 필요 |
| `relay-dev` | 환경 3 — intoss-private candidate relay | side-effect unguarded (dogfood) |
| `relay-live` | 환경 4 — LIVE 번들 relay | **`confirm: true` 필수** (LIVE side-effect guard) |

`relay-live`로 전환할 때 `confirm: true`를 빠뜨리면 서버가 진입을 거부한다. 이후
`call_sdk`/`evaluate` 등도 LIVE에서는 `confirm: true`가 필요한 2중 게이트가 적용된다
(비가역 부작용 방지). `relay-live` 이후 `local-*` mode로 전환하면 guard가 자동 해제된다.

**`MCP_ENV`** (deprecated back-compat): 부팅 시 `liveIntent`를 시드하는 용도로만 남은
구버전 별칭이다. 신규 환경 진입에는 `start_debug`를 쓴다 — `MCP_ENV`를 서버 기동 전에
명시하는 방식은 정본 진입 경로가 아니다.

`start_debug` 호출 후 폰에 relay를 붙이려면 바로 아래 5-B·5-C 순서를 따른다.

### 5-B. candidate 번들 준비

attach 경로에는 이미 올라가 있는 candidate scheme URL이 필요하다. 없으면 먼저
`/ait deploy`로 빌드·업로드한다:

```bash
# 1. .ait 번들 빌드 (web-framework 3.0 번들러)
ait build

# 2. candidate를 콘솔에 업로드 (검수 제출은 하지 않음 — PREPARE 상태 유지)
aitcc app deploy ./<appName>.ait

# 3. deploymentId로 scheme URL 조회
aitcc app bundles ls
```

`ait`는 번들러(`@apps-in-toss/web-framework`에 내장) — `aitcc`(콘솔 자동화, console-cli)가 아니다.
`aitcc app deploy`는 업로드만 하고 검수를 제출하지 않으므로 PREPARE 상태에서
cold-load할 수 있다. 간편하게는 `/ait deploy`를 쓴다.

### 5-C. attach — `start_debug` → `build_attach_url` QR

1. **`start_debug`** 도구를 먼저 호출해 relay mode를 설정한다:
   - 환경 3: `start_debug({mode: 'relay-dev'})`
   - 환경 4: `start_debug({mode: 'relay-live', confirm: true})`

   이 단계가 "어느 환경을 쓸 것인가"를 결정한다. 서버가 해당 relay connection을
   active로 잡고, 이후 `build_attach_url`에서 relay endpoint를 splice할 준비를 한다.

2. **`build_attach_url`** 도구를 호출한다 (5-B에서 얻은 scheme URL 전달).
   서버가 `?debug=1&relay=<wss://<random>.trycloudflare.com>`을 splice해 attach용
   deep link를 합성하고, **QR PNG를 OS 기본 이미지 뷰어로 자동 연다** (ASCII QR도
   터미널에 병행 출력).

   예시 deep link 형태 (실제 값은 도구 호출 결과로 받음):
   ```
   intoss-private://<app-id>?_deploymentId=<deployment-id>&debug=1&relay=wss://<random>.trycloudflare.com
   ```

3. 사용자가 **폰 카메라로 QR을 스캔**한다 — 이게 환경 3·4의 단일 진입 경로다.
   QR 스캔은 USB 연결·플랫폼별 CLI·드라이버 의존이 0이라 iOS/Android 동일하게
   동작한다. `devicectl`/`adb` 같은 device-control 발사는 쓰지 않는다(brittle,
   실유저 플로우 아님).

4. 폰 토스 앱 WebView가 deep link를 열면 in-app gate를 통과해 relay에 attach된다.

### 5-D. attach 확인 및 도구 자동 등록

1. **`list_pages`** 도구를 호출해 attach 여부를 확인한다.
   - attach 전: 빈 목록 → 5-C 3번 QR 스캔으로 돌아간다.
   - attach 후: 연결된 페이지(WebView) 목록이 보인다.

2. attach 성공 순간 서버가 `notifications/tools/list_changed`를 emit → Claude Code가
   tool 목록을 자동 갱신한다. 다음 9종의 attach 의존 도구가 **같은 세션에서 즉시
   callable**해진다 — 세션 재시작·재승인 불필요:

   | 도구 | 용도 |
   |---|---|
   | `list_console_messages` | WebView console 출력·예외 스택 읽기 |
   | `list_network_requests` | fetch/XHR 왕복·응답 상태 확인 |
   | `get_dom_document` | 현재 DOM 스냅샷 (ARIA tree 포함) |
   | `take_snapshot` | 페이지 접근성 트리 캡처 |
   | `take_screenshot` | 폰 화면 PNG 캡처 |
   | `measure_safe_area` | safe-area inset 측정 (노치·홈바 여백) |
   | `call_sdk` | SDK 메서드 직접 호출 (권한 확인, 스토리지 읽기 등) |
   | `evaluate` | WebView JS 표현식 평가 |
   | `get_diagnostics` | relay 연결 상태·latency 진단 |

3. 이 도구들로 폰 안 `.ait` 번들의 console/network/DOM/safe-area를 읽고 회귀를
   진단한다.

**attach 전에 보이는 도구는 bootstrap 4종(`start_debug`·`build_attach_url`·
`list_pages`·`get_diagnostics`)뿐이다** — 그게 정상이다. 나머지 9종이 안 보이면 아직 폰이 안
붙은 것이니 5-C 3번 QR 스캔으로 돌아간다.

> SECRET-HANDLING: relay attach에 시크릿/인증 코드가 쓰이더라도 그 값을
> stdout/로그/메시지에 절대 출력하지 않는다. attach 실패 사유는 enum 수준으로만 보고.
> deep link/wssUrl의 실제 값도 예시가 아닌 한 그대로 인쇄하지 않는다.

## Out of scope (이 skill이 하지 않는 것)

- ❌ 브라우저·폰을 직접 조작 — 환경 1은 사용자가 `pnpm dev`로 띄운 환경을 가정,
  환경 3·4의 QR 스캔은 사람이 폰 카메라로 한다(이 skill은 QR을 발급).
- ❌ `ait-devtools` MCP 서버 기동 — plugin manifest가 상시 기동하므로 이 skill은
  attach 경로만 발급한다.
- ❌ candidate 번들 빌드·배포 — `/ait setup-bundle` → `/ait register` → `/ait deploy`.
- ❌ 검수 큐 제출(환경 3→4 전환, 비가역) — 명시 승인 없이 하지 않는다.
- ❌ devtools 설정 주입 — `/ait inject-devtools`.
- ❌ 실기기 WebKit dev 미리보기 배선 — `/ait setup-phone-preview`(환경 2, 토스 앱 불필요).
- ❌ 콘솔 인증·앱 등록·운영 조회 — `/ait deploy`, `/ait register`, `/ait status`.
- ❌ 코드 자동 수정 — 관찰·진단을 돕고, 수정은 에이전트의 일반 편집 흐름으로.

## 하지 말아야 할 것

- ❌ attach 전에 attach 의존 도구가 안 보이는 걸 "버그"로 오인. bootstrap 4종
  (`start_debug`·`build_attach_url`·`list_pages`·`get_diagnostics`)만 보이는 게 정상이고, 폰이
  붙으면 나머지 9종이 동적 등록된다(5-D).
- ❌ `devicectl`/`adb` 등 device-control로 폰을 발사. 진입은 QR 스캔 단일 경로다(5-C).
- ❌ 시크릿/인증 코드 값을 stdout·로그·메시지에 출력.
- ❌ `window.__ait`의 메서드명을 고정으로 단정. 버전에 따라 다를 수 있으니 객체를
  펼쳐 확인하도록 안내.
- ❌ 미구현 mock의 throw를 "버그"로 오인. 의도된 동작이며 누락 API는 devtools
  이슈로 보고 안내.
- ❌ 메시지에 "공식(official)", "토스가 제공하는", "powered by Toss" 등
  제휴·후원·인증 암시 표현.
- ❌ `MCP_ENV` 기반 구버전 진입 방식에 의존. 환경 전환은 `start_debug({mode})`로
  런타임에 한다 — 서버 재구동이 필요 없고 `MCP_ENV`를 미리 설정할 필요도 없다(5-A).
- ❌ `ait build` 대신 `aitcc`로 번들 빌드 시도. `ait`(번들러, web-framework 내장)와
  `aitcc`(콘솔 자동화)는 별개 도구다(5-B). 빌드는 `ait build`, 업로드는 `aitcc app deploy`.

## 다음 단계 (관찰 결과에 따라 분기)

- **환경 1에서 재현·진단 끝** → 수정은 에이전트의 일반 편집 흐름으로. 브라우저에서
  재현되지 않고 실기기 엔진 fidelity가 의심되면 먼저 `/ait setup-phone-preview`로
  환경 2(AITC Sandbox PWA)를 시도한다(토스 앱 deploy 불필요, 실기기 WebKit 엔진
  확인 가능). 그래도 토스 WebView·SDK 네이티브 거동이 필요한 회귀라면 환경 3으로:
  `/ait deploy`로 candidate를 만들고 5-C의 QR attach.
- **candidate scheme URL이 아직 없음** → `/ait setup-bundle` → `/ait register` →
  `/ait deploy`로 candidate를 만든 뒤 다시 `/ait debug`.
- **`start_debug` 호출 후 `build_attach_url` 스캔 대기 중** → 폰 카메라로 QR 스캔.
  attach 후 `list_pages`로 확인 → 페이지가 보이면 5-D의 9종 도구로 디버깅 시작.
- **attach는 됐는데 도구가 아직 안 보임** → `notifications/tools/list_changed`가
  Claude Code에 전달되기까지 수 초 걸릴 수 있다. 잠시 후 에이전트의 도구 목록을
  다시 확인. 여전히 없으면 `get_diagnostics`로 relay 연결 상태 점검.
- **환경 4(LIVE) 운영 관측** → `/ait status`, `/ait logs`로 콘솔 상태도 함께 확인.

## 참고

- 짝 skill: `inject-devtools` (panel 설정), `setup-phone-preview` (환경 2(AITC Sandbox PWA) 진입 — 실기기 WebKit dev 미리보기 tunnel).
- 환경 4겹 × fidelity 설계 정본: umbrella `meta/four-environments-fidelity.md` (§1 환경 모델, §5 동적 도구 등록, §7 CDP 단일 transport).
- 환경 3·4 진입 시나리오 + QR relay 흐름: https://github.com/apps-in-toss-community/devtools/blob/main/docs/scenarios/env-3.md
- dogfood relay 루프 (candidate 빌드 → QR 스캔 → attach → 관측 사이클): https://github.com/apps-in-toss-community/devtools/blob/main/docs/dogfood-relay-loop.md
- devtools (mock + panel + MCP): https://github.com/apps-in-toss-community/devtools
- devtools live demo: https://devtools.aitc.dev/
- on-device debug (CDP relay MCP): `@ait-co/devtools` `./in-app` + `./mcp` + `devtools-mcp` bin. plugin manifest `mcpServers."ait-devtools"`가 `npx -y @ait-co/devtools devtools-mcp`로 기동.
- 커뮤니티 docs — lifecycle 디버깅(swipe-back 등): https://docs.aitc.dev/guides/navigation-flow
- 커뮤니티 docs — 환경 4겹 개요: https://docs.aitc.dev/guides/four-environments
