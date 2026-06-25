---
name: debug
description: |
  Help debug an Apps in Toss mini-app across four environments. Environment 1
  (local browser): the `@ait-co/devtools` floating panel (mock state, 12 tabs),
  the `window.__ait` runtime state object, and the browser's own DevTools
  (console / network). Environment 2 (AITC Sandbox App (PWA)): real-device WebKit
  engine via an installable PWA (`devtools.aitc.dev/launcher/`) — this skill's
  MCP attach path via `start_debug({mode:'relay-sandbox'})` → `build_attach_url`
  launcher QR; the SDK is mock so CDP observation only (no real SDK calls);
  PWA tunnel infrastructure must be set up first via `/ait setup-phone-preview`
  (`tunnel:{cdp:true}`), then this skill launches the dev server automatically.
  The `ait-devtools` MCP server is registered by this plugin and always running.
  Environments 3/4 (on-device intoss-private candidate / live bundle): call
  `start_debug({mode})` to switch at runtime without restarting the server,
  then issue a QR attach URL via `build_attach_url`; once the phone scans it
  and the relay attaches, attach-dependent tools register dynamically in the
  same session. `/ait debug` branches by what it observes and prints the right
  path. Triggered by `/ait debug`.
argument-hint: ''
adapter-note: '§5 (on-device MCP attach) is Claude Code-only — run_in_background, /mcp auto-start, notifications/tools/list_changed handling are Claude Code-specific. Replace §5 with an adapter-specific overlay when targeting other agents.'
---

# debug skill

## 목적

`/ait debug`는 미니앱을 **네 겹의 환경**에서 디버깅하는 경로를 안내한다. 한 명령이
관찰 결과에 따라 환경을 분기한다 (umbrella `CLAUDE.md` §1.1 환경 4겹 모델):

| 환경 | 실행 면 | 이 skill의 경로 |
|---|---|---|
| 1. 로컬 브라우저 | desktop Chromium + mock SDK + Panel | 2-A/2-B/3 — panel · `window.__ait` · 브라우저 DevTools |
| 2. AITC Sandbox App (PWA) | 실기기 Safari/WebKit + installable PWA(`devtools.aitc.dev/launcher/`) + cloudflared 터널 | 5 — `start_debug({mode:'relay-sandbox'})` → `build_attach_url` launcher QR attach (mock SDK; CDP는 실 WebKit; `setup-phone-preview`로 `dev:phone:cdp` 스크립트 + CDP relay 배선 선행, 이 skill이 dev 서버 기동 자동화) |
| 3. intoss-private relay dev | 실기기 토스 앱 WebView(dogfood) + CDP relay | 5 — `start_debug({mode:'relay-staging'})` → `build_attach_url` QR attach |
| 4. intoss live relay debug | 실기기 토스 앱 WebView(LIVE, 검수 통과) + CDP relay | 5 — `start_debug({mode:'relay-live', confirm:true})` → `build_attach_url` QR (read-only) |

- **환경 1**은 지금 바로, 의존 없이 쓴다:
  - `@ait-co/devtools`의 floating panel — mock 상태(권한·위치·IAP·이벤트 등)를
    실시간 관찰·조작 (12개 탭).
  - `window.__ait` — 런타임 mock SDK 상태 객체. 콘솔이나 에이전트가 직접 읽는다.
  - 브라우저 기본 DevTools — console / network / sources.
- **환경 2·3·4**는 `ait-devtools` MCP 서버로 닿는다. 이 서버는 plugin이 manifest에
  등록해 **상시 기동**되므로, `/ait debug`는 새 서버를 띄우지 않고 **`start_debug({mode})`로
  runtime 환경을 설정한 뒤 attach 경로를 발급**한다(아래 5). 환경 2(`relay-sandbox` mode)는
  launcher QR이 PWA로 연결되고, 환경 3·4는 intoss-private/LIVE WebView로 연결된다.
  **환경 2에서 `call_sdk`/`evaluate` 실 SDK 호출은 불가**하다(mock SDK) — CDP 기반
  관측(DOM·console·network·screenshot·safe-area)만 쓸 수 있다. 실 SDK fidelity가
  필요하면 환경 3(intoss-private dogfood)으로 올라가야 한다. attach 전에는 bootstrap 도구
  (`start_debug`·`build_attach_url`·`list_pages`·`get_debug_status`)만 보이고, 폰이
  relay에 붙으면 나머지 도구가 같은 세션에서 동적 등록된다.

생성·수정하는 모든 메시지에서 "공식(official)", "토스가 제공하는",
"powered by Toss" 등 제휴·후원·인증 암시 표현을 쓰지 않는다.

## 의존

- **`@ait-co/devtools`가 devDependencies에 있어야** floating panel을 쓸 수 있다.
  없으면 `/ait inject-devtools`를 먼저 안내한다 (없어도 브라우저 기본 DevTools
  가이드는 진행 가능).
- **`package.json`이 cwd에 있어야 한다**. 없으면 프로젝트 루트로 이동 안내.
- **환경 1**: 에이전트가 필요 시 dev 서버를 자동 기동한다(아래 2-A 사전 기동 블록).
- **환경 2**: 이 skill이 `pnpm dev:phone:cdp`를 자동으로 기동한다(`dev:phone:cdp` 스크립트가 없으면 먼저 `/ait setup-phone-preview` 안내).

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

**dev 서버 사전 기동 (idempotent)**:

에이전트는 패널 안내 전에 dev 서버가 이미 기동 중인지 확인하고, 아닐 경우 자동으로 띄운다.

1. **dev 명령 + 기본 포트 확인**: `package.json`의 `scripts.dev`를 읽어 실제 명령을 확인한다. 포트는 다음 순서로 결정한다 — devtools는 Vite뿐 아니라 Next.js·Rspack·Webpack 프로젝트에도 주입될 수 있으므로 5173을 가정하지 않는다:
   - `scripts.dev`에 `--port <n>`(또는 Next.js `-p <n>`)가 있으면 그 값.
   - 없으면 config 파일로 빌드 도구를 판별해 기본 포트: `vite.config.*` → 5173, `next.config.*` → 3000, `rspack.config.*`/`webpack.config.*` → 8080.

2. **기동 여부 확인**: 위에서 결정한 포트(`$PORT`)가 응답하는지 확인한다:

   ```bash
   # 포트가 이미 열려 있으면 dev 서버가 기동 중 ($PORT = 위 1단계에서 결정)
   curl -s -o /dev/null -w "%{http_code}" "http://localhost:$PORT/" || true
   ```

   200 응답이면 이미 기동 중 — 기동 단계를 건너뛴다. 연결 거부(exit code ≠ 0 또는 000)이면 아직 미기동.

3. **미기동 시 백그라운드 기동**: `run_in_background: true`로 dev 서버를 시작한다:

   ```bash
   # run_in_background: true 로 실행
   pnpm dev
   ```

4. **URL 출력**: Vite가 stdout에 `Local: http://localhost:<port>/`를 출력한다. 에이전트는 이 줄을 파싱해 포트를 확인하고 사용자에게 URL을 명시적으로 알린다:

   ```
   dev 서버가 기동됐습니다: http://localhost:5173/
   브라우저에서 이 주소를 열어주세요. (브라우저는 직접 여세요 — 에이전트는 URL만 알려드립니다.)
   ```

   stdout의 `Local: http://localhost:<port>/` 줄을 파싱해 실제 포트를 확인한다(빌드 도구마다 출력 형식이 조금씩 다르다). 파싱 전 예상 포트는 위 1단계에서 결정한 값(Vite 5173 / Next.js 3000 / Rspack·Webpack 8080, 또는 `--port` 명시값)이다.

브라우저에서 연 뒤 화면 하단의 **AIT** 버튼을 누르면 패널이 열린다. 증상별로 볼 탭:

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
window.__ait         // 상태 매니저 전체 (update/patch/subscribe/transaction 메서드)
window.__ait?.state  // 현재 상태 스냅샷 (AitDevtoolsState getter — 메서드 아님)
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

## 5. on-device 디버깅 (환경 2·3·4) — MCP attach

브라우저 디버깅(1~4)은 **dev 번들**(mock + panel)에만 적용된다. 실기기에서 도는
번들은 mock도 panel도 없어, 폰에서만 재현되는 회귀(예: native swipe-back)는
CDP(Chrome DevTools Protocol) relay로 attach해야 관측된다.
이 경로는 `ait-devtools` MCP 서버가 담당한다 — plugin manifest의 `mcpServers`에
등록돼 **상시 기동**되므로(`/mcp`에 `ait-devtools`로 뜬다), 이 skill은 새 서버를
띄우지 않고 attach 경로만 발급한다.

> **환경 2(AITC Sandbox App (PWA))**: 이 §5의 `relay-sandbox` mode가 환경 2 attach
> 경로다. 실기기 WebKit 엔진을 토스 앱·검수 없이 볼 수 있다. 단 아래 전제가
> 갖춰져 있어야 한다(갖춰지지 않으면 CDP relay가 뜨지 않고 이 경로가 막힌다):
>
> 1. `/ait setup-phone-preview`가 `vite.config`에
>    `tunnel: process.env.AIT_TUNNEL ? { cdp: !!process.env.AIT_TUNNEL_CDP } : false`
>    를 주입했는지, `dev:phone:cdp` 스크립트가 `package.json`에 있는지 확인한다.
>    없으면 먼저 `/ait setup-phone-preview`를 실행한다.
> 2. 이 skill이 **`pnpm dev:phone:cdp`** (`AIT_TUNNEL=1 AIT_TUNNEL_CDP=1 vite`)를
>    백그라운드로 자동 기동한다(5-C relay-sandbox 분기 첫 단계 참조).
>    이 명령이 cloudflared 터널 + Chii relay를 boot한다.
>    `pnpm dev:phone`(screen-only)은 CDP relay를 띄우지 않으므로 이 경로에서 쓰면 안 된다.
> 3. 터널 준비 완료 신호(`<projectRoot>/.ait_urls` 파일 생성)를 확인한 뒤
>    `start_debug({mode: 'relay-sandbox'})` → 이후 attach 경로를 진행한다.
>
> 환경 2에서는 SDK가 mock이라 `call_sdk`/`evaluate` 실 SDK 호출은 불가 — CDP 관측 도구만
> 쓸 수 있다.

### 5-A. 환경 분기

폰 디버깅은 세 환경 중 하나다. 사용자가 어느 환경을 보는지로 가른다:

- **환경 2 (AITC Sandbox App (PWA))** — 토스 앱·검수 없이 실기기 WebKit 엔진을 볼 수 있는
  launcher PWA(`devtools.aitc.dev/launcher/`). `/ait setup-phone-preview`로 `vite.config`에 tunnel 옵션을 주입하고
  `dev:phone:cdp` 스크립트를 추가한 뒤, 이 skill이 **`pnpm dev:phone:cdp`**
  (`AIT_TUNNEL=1 AIT_TUNNEL_CDP=1`)로 dev 서버를 자동 기동해 CDP relay를 boot한다.
  `pnpm dev:phone`(screen-only)은 CDP relay를 띄우지 않으므로 이 경로에서 쓰지 않는다.
  **mock SDK** — CDP 관측 전용.
  5-C의 `relay-sandbox` 분기에서 launcher QR을 발급한다.
- **환경 3 (intoss-private candidate)** — `RELEASE_CHANNEL=dogfood`로 빌드해
  `ait deploy --scheme-only`가 출력한 `intoss-private://…?_deploymentId=<uuid>`
  candidate. PREPARE 상태에서도 cold-load된다. 출시 전 실기기 개발 루프.
- **환경 4 (intoss live)** — 검수를 통과해 LIVE인 번들(`intoss://…`). 동일 relay로
  붙되 **read-only 관측**만. 검수 큐 제출(비가역)은 이 skill의 범위가 아니다.

환경 2 진입에는 candidate 번들이 필요 없다(터널만). 환경 3·4에 candidate scheme URL이
없으면 먼저 station 5(`/ait setup-bundle` → `/ait register` → `/ait deploy`)로
candidate를 만들도록 안내한다.

#### `start_debug(mode)` — 런타임 환경 전환 (정본 진입 경로)

`ait-devtools` 데몬은 **상시 기동** 상태로, 환경 진입은 **서버 재구동 없이** MCP 도구
`start_debug({mode})`를 호출해 런타임에 결정한다. plugin manifest가 등록하는 기본
데몬(`npx -y @ait-co/devtools devtools-mcp`)은 내부적으로 dual-connection 라우터로
동작하므로, **환경 1·2·3·4 네 가지 mode 모두 한 데몬에서 warm swap으로 오갈 수 있다**
(Claude Code 재구동·MCP 재핸드셰이크 불필요). 환경 2(`relay-sandbox`) 진입에 별도
`--target=mobile` 데몬을 띄울 필요는 없다.

| `mode` 값 | 환경 | 특이사항 |
|---|---|---|
| `local-browser` | 환경 1 — mock Chromium panel / 브라우저 CDP | 기본값. panel 모드와 CDP 직접 연결 모두 이 mode 사용 |
| `relay-sandbox` | 환경 2 — 실기기 PWA (외부 relay) | mock SDK; `dev:phone:cdp` 스크립트 + `tunnel:{cdp:true}`가 띄운 relay에 붙는다. 데몬이 런타임에 이 외부 relay 패밀리를 lazy-boot한다 — 아래 사전 조건 참조 |
| `relay-staging` | 환경 3 — intoss-private candidate relay | side-effect unguarded (dogfood) |
| `relay-live` | 환경 4 — LIVE 번들 relay | **`confirm: true` 필수** (LIVE side-effect guard) |

> **`relay-sandbox`(환경 2) 진입 — 기본 데몬에서 런타임 전환 가능**:
> 환경 3·4(`relay-staging` / `relay-live`)는 MCP 데몬이 자체 relay를 띄우지만,
> 환경 2는 Vite dev 서버의 unplugin(`tunnel:{cdp:true}`)이 **먼저 띄운 외부 relay**에
> MCP가 CDP 클라이언트로 붙는 구조다(아키텍처 상수 — 데몬이 이 relay를 스스로 못 만든다).
>
> plugin manifest가 등록하는 기본 데몬(`npx -y @ait-co/devtools devtools-mcp`)은
> dual-connection 라우터로 동작하므로, `start_debug({mode:'relay-sandbox', projectRoot})`
> 호출 시 이 외부 relay 패밀리를 **런타임에 lazy-boot**해 붙는다. 별도
> `--target=mobile` 데몬을 띄우거나 MCP 서버를 재시작할 필요가 없다.
>
> 유일한 전제는 외부 relay 주소다: `/ait setup-phone-preview`로 배선하고
> `pnpm dev:phone:cdp`를 기동하면 `<projectRoot>/.ait_urls`(또는 `AIT_RELAY_BASE_URL`
> env var)가 채워지고, 데몬이 이를 읽어 relay endpoint를 구성한다. 이 주소가 없으면
> `start_debug`는 **relay 주소 미설정 에러**(env var 이름을 짚고 "dev 서버를
> `tunnel:{cdp:true}`로 기동하라"는 안내)를 돌려준다 — "데몬을 재시작하라"가 아니라
> "환경 2를 먼저 배선하라"는 뜻이다. 따라서 진입 순서는 `/ait setup-phone-preview`
> → `pnpm dev:phone:cdp` → `start_debug({mode:'relay-sandbox'})`이다(5-C relay-sandbox 분기).
>
> **fallback — 수동 `/mcp` 재구성(거의 불필요)**: 기본 데몬을 그대로 쓰면 위처럼
> 자동으로 동작한다. 어떤 이유로 데몬이 single-connection으로 떠 있어
> `start_debug({mode:'relay-sandbox'})`가 "이 세션은 단일 연결만 보유합니다" 류 에러를
> 돌려준다면, 데몬을 dual-connection으로 재구성한다:
>
> 1. `~/.claude/settings.json`을 열거나 `/mcp` → `ait-devtools` 선택 → Edit.
> 2. 해당 서버의 `args` 배열에 `"--target=mobile"`을 추가한다.
> 3. Claude Code를 재시작하거나 해당 MCP 서버를 재초기화해 dual-connection 데몬을
>    다시 부팅한다.
>
> 이 fallback도 relay 배선(`/ait setup-phone-preview` + `pnpm dev:phone:cdp`)이
> 선행돼야 `start_debug`가 외부 relay를 발견한다.

`relay-live`로 전환할 때 `confirm: true`를 빠뜨리면 서버가 진입을 거부한다. 이후
`call_sdk`/`evaluate` 등도 LIVE에서는 `confirm: true`가 필요한 2중 게이트가 적용된다
(비가역 부작용 방지). `relay-live` 이후 `local-*` mode로 전환하면 guard가 자동 해제된다.

**`MCP_ENV`** (deprecated back-compat): 부팅 시 `liveIntent`를 시드하는 용도로만 남은
구버전 별칭이다. 신규 환경 진입에는 `start_debug`를 쓴다 — `MCP_ENV`를 서버 기동 전에
명시하는 방식은 정본 진입 경로가 아니다.

`start_debug` 호출 후 폰에 relay를 붙이려면 바로 아래 5-B·5-C 순서를 따른다.

### 5-B. candidate 번들 준비 (환경 3·4만)

환경 2(`relay-sandbox`) attach에는 candidate 번들이 필요 없다 — `/ait setup-phone-preview`가
배선한 터널이 있으면 된다(이 skill이 자동 기동). 환경 3·4는 이미 올라가 있는 candidate scheme URL이 필요하다.
candidate scheme URL이 없으면 먼저 `/ait deploy`를 실행하세요 — 빌드·인증·업로드를 자동 처리하고 scheme URL을 돌려줍니다. URL을 받으면 5-C로 돌아와 `build_attach_url`에 전달합니다.

### 5-C. attach — `start_debug` → `build_attach_url` QR

환경에 따라 분기한다.

**환경 2 (relay-sandbox) 경로:**

0. **사전 조건 확인**: `vite.config`에 tunnel 옵션(`tunnel: process.env.AIT_TUNNEL ? {...} : false` 형태)이 있고 `package.json`에 `dev:phone:cdp` 스크립트가 있는지 확인한다.
   - 없으면: **환경 2 배선이 아직 완료되지 않았습니다. 먼저 `/ait setup-phone-preview`를 실행하세요.** 여기서 중단.

1. **dev 서버 기동 (idempotent)**: `<projectRoot>/.ait_urls` 파일이 이미 존재하면 dev 서버가 이미 기동 중이므로 이 단계를 건너뛴다. 존재하지 않으면 에이전트가 Bash 도구로 **`pnpm dev:phone:cdp`를 백그라운드에서 기동**한다(`run_in_background: true`):

   ```bash
   # run_in_background: true 로 실행
   pnpm dev:phone:cdp
   ```

   이 명령이 `AIT_TUNNEL=1 AIT_TUNNEL_CDP=1` 조건으로 Vite를 기동하고, 두 개의 cloudflared 터널(앱 HTTP + relay wss)을 boot한다.

2. **준비 완료 대기**: `<projectRoot>/.ait_urls` 파일이 생성될 때까지 폴링한다(터널 boot 소요 시간은 보통 2~15초). 파일은 devtools unplugin이 터널 resolve 후 기록하는 준비 완료 신호다.

   ```bash
   # 파일 존재 여부만 확인 — 내용을 읽거나 출력하지 않는다 (SECRET-HANDLING)
   ls .ait_urls
   ```

   파일이 생기면 다음 단계로 진행한다. `.ait_urls`의 내용(URL 값)은 절대 읽거나 출력하지 않는다.

3. **`start_debug({mode: 'relay-sandbox', projectRoot})`** 도구를 호출한다. 데몬이 `.ait_urls`를 fallback으로 읽어 relay endpoint를 구성한다.

4. **`build_attach_url()`** 도구를 호출한다(scheme URL 불필요 — 환경 2는
   `.ait_urls`에서 읽은 터널을 사용, 환경 3·4의 scheme URL과 다름). 서버가
   launcher PWA URL에 relay를 splice해 **QR PNG를 OS 기본 이미지 뷰어로 자동 연다**
   (ASCII QR도 터미널에 병행 출력).

5. 사용자가 **폰 카메라로 QR을 스캔**한다 → 실기기 WebKit에서 launcher PWA가
   열리고 relay에 attach된다. (`devicectl`/`adb` 같은 device-control 발사는
   쓰지 않는다 — 실유저 플로우 아님.)

**환경 3·4 경로:**

1. **`start_debug`** 도구를 먼저 호출해 relay mode를 설정한다:
   - 환경 3: `start_debug({mode: 'relay-staging', projectRoot})`
   - 환경 4: `start_debug({mode: 'relay-live', confirm: true, projectRoot})`

   이 단계가 "어느 환경을 쓸 것인가"를 결정한다. 서버가 해당 relay connection을
   active로 잡고, 이후 `build_attach_url`에서 relay endpoint를 splice할 준비를 한다.

2. **`build_attach_url`** 도구를 호출한다 (5-B에서 얻은 scheme URL 전달).
   서버가 `?debug=1&relay=<wss://<random>.trycloudflare.com>`을 splice해 attach용
   deep-link를 합성하고, **QR PNG를 OS 기본 이미지 뷰어로 자동 연다** (ASCII QR도
   터미널에 병행 출력).

   예시 deep-link 형태 (실제 값은 도구 호출 결과로 받음):
   ```
   intoss-private://<app-id>?_deploymentId=<deployment-id>&debug=1&relay=wss://<random>.trycloudflare.com
   ```

3. 사용자가 **폰 카메라로 QR을 스캔**한다 — 이게 환경 3·4의 단일 진입 경로다.
   QR 스캔은 USB 연결·플랫폼별 CLI·드라이버 의존이 0이라 iOS/Android 동일하게
   동작한다. `devicectl`/`adb` 같은 device-control 발사는 쓰지 않는다(brittle,
   실유저 플로우 아님).

4. 폰 토스 앱 WebView가 deep-link를 열면 in-app gate를 통과해 relay에 attach된다.

### 5-D. attach 확인 및 도구 자동 등록

1. **`list_pages`** 도구를 호출해 attach 여부를 확인한다.
   - attach 전: 빈 목록 → 5-C 스캔 단계로 돌아간다.
   - attach 후: 연결된 페이지(WebView) 목록이 보인다.

2. attach 성공 순간 서버가 `notifications/tools/list_changed`를 emit → Claude Code가
   tool 목록을 자동 갱신한다. 다음 13종의 attach 의존 도구가 **같은 세션에서 즉시
   callable**해진다 — 세션 재시작·재승인 불필요:

   | 도구 | 용도 |
   |---|---|
   | `list_console_messages` | WebView console 출력·예외 스택 읽기 |
   | `list_network_requests` | fetch/XHR 왕복·응답 상태 확인 |
   | `list_exceptions` | 런타임 예외 ring buffer 읽기 |
   | `get_dom_document` | 현재 DOM 스냅샷 (ARIA tree 포함) |
   | `take_snapshot` | 페이지 접근성 트리 캡처 |
   | `take_screenshot` | 폰 화면 PNG 캡처 |
   | `measure_safe_area` | safe-area inset 측정 (노치·홈바 여백) |
   | `call_sdk` | SDK 메서드 직접 호출 — **환경 2(relay-sandbox)에서 불가** (mock SDK) |
   | `evaluate` | WebView JS 표현식 평가 — **환경 2(relay-sandbox)에서 실 SDK 접근 불가** (mock SDK) |
   | `run_tests` | 프로젝트의 `*.phone.test.ts` 파일을 이미 attach된 실기기 WebView에서 실행해 pass/fail/skip 결과 반환 — **환경 2(relay-sandbox)에서 SDK는 mock이므로 실 SDK 동작 검증 불가** (DOM·console·타이밍 fidelity 검증은 가능) |
   | `AIT.getSdkCallHistory` | SDK 호출 이력 조회 |
   | `AIT.getMockState` | devtools mock 상태 스냅샷 조회 |
   | `AIT.getOperationalEnvironment` | 운영 환경 정보 + SDK 버전 조회 |

3. 이 도구들로 폰 안 `.ait` 번들의 console/network/DOM/safe-area를 읽고 회귀를
   진단한다.

**attach 전에 보이는 도구는 bootstrap 4종(`start_debug`·`build_attach_url`·
`list_pages`·`get_debug_status`)뿐이다** — 그게 정상이다. 나머지 13종이 안 보이면 아직 폰이 안
붙은 것이니 5-C 스캔 단계로 돌아간다.

> SECRET-HANDLING: relay attach에 시크릿/인증 코드가 쓰이더라도 그 값을
> stdout/로그/메시지에 절대 출력하지 않는다. attach 실패 사유는 enum 수준으로만 보고.
> deep-link/wssUrl의 실제 값도 예시가 아닌 한 그대로 인쇄하지 않는다.
> 환경 2의 tunnel URL도 동일 규칙 — wss-class 터널 호스트이므로 값을 로그·메시지에
> 직접 인쇄하지 않는다. placeholder 형태(`https://<HOST>.trycloudflare.com`)로만 참조한다.
> **`.ait_urls` 파일은 존재 여부(boolean)만 확인하고 내용은 절대 읽거나 출력하지 않는다.**

### 5-E. 실기기 테스트 실행 — `run_tests`

attach가 완료된 상태(5-D에서 `list_pages`로 페이지가 확인된 후)라면, 프로젝트에 `*.phone.test.ts` 파일이 있을 경우 **같은 relay 연결을 그대로 재사용**해 실기기 WebView에서 테스트를 실행할 수 있다.

```
run_tests({
  files: ["**/*.phone.test.ts"],
  projectRoot: "<프로젝트 루트 경로>"
})
```

- `files` (필수) — glob 패턴 또는 경로 배열. `projectRoot` 기준으로 탐색한다.
- `projectRoot` (선택) — glob 기준 디렉토리. 생략 시 MCP 데몬의 cwd.
- `timeout_ms` (선택) — 파일당 평가 타임아웃(ms). 기본값 30000, 범위 1000–600000.
- `confirm` (선택) — **환경 4(`relay-live`) 에서는 `true` 필수**. 테스트 파일이 실 SDK를 호출해 LIVE 번들에 부작용을 낼 수 있기 때문이다(`call_sdk`/`evaluate`의 LIVE guard와 동일 원리). 환경 2·3에서는 불필요.

결과는 파일별 pass/fail/skip + 합산 totals `{passed, failed, skipped, total}`으로 돌아온다. 시작/완료 로그는 카운트만 포함하며 시크릿은 싣지 않는다.

**환경 2(`relay-sandbox`) 주의**: SDK가 mock이므로 실 SDK 동작(네이티브 브리지·권한·결제 등)은 검증할 수 없다. DOM·console·타이밍 fidelity 검증에는 유효하다. 실 SDK 동작을 테스트하려면 환경 3(intoss-private dogfood)에서 실행한다.

`run_tests`는 별도 relay 연결을 열지 않는다 — 이미 attach된 세션 위에서 동작하므로, 5-C → 5-D 흐름 이후 추가 QR 스캔 없이 바로 호출할 수 있다.

## Out of scope (이 skill이 하지 않는 것)

- ❌ 브라우저를 직접 열기 — 환경 1에서 에이전트는 dev 서버를 자동 기동하고 URL을 출력하며,
  브라우저는 사용자가 직접 연다(에이전트는 URL만 출력). 환경 2·3·4의 QR 스캔은 사람이 폰 카메라로 한다(이 skill은 QR을 발급).
- ❌ `ait-devtools` MCP 서버 기동 — plugin manifest가 상시 기동하므로 이 skill은
  attach 경로만 발급한다.
- ❌ candidate 번들 빌드·배포 — `/ait setup-bundle` → `/ait register` → `/ait deploy`.
  (환경 2는 candidate 번들 불필요 — 터널만.)
- ❌ 검수 큐 제출(환경 3→4 전환, 비가역) — 명시 승인 없이 하지 않는다.
- ❌ devtools 설정 주입 — `/ait inject-devtools`.
- ❌ 환경 2 PWA 터널 인프라 배선 — `/ait setup-phone-preview`(vite.config tunnel 옵션 주입 + `dev:phone:cdp` 스크립트 추가). 이 skill은 그 위에서(배선이 완료된 상태에서) dev 서버를 자동 기동하고 CDP attach/관측을 담당한다.
- ❌ 콘솔 인증·앱 등록·운영 조회 — `/ait deploy`, `/ait register`, `/ait status`.
- ❌ 코드 자동 수정 — 관찰·진단을 돕고, 수정은 에이전트의 일반 편집 흐름으로.

## 하지 말아야 할 것

- ❌ attach 전에 attach 의존 도구가 안 보이는 걸 "버그"로 오인. bootstrap 4종
  (`start_debug`·`build_attach_url`·`list_pages`·`get_debug_status`)만 보이는 게 정상이고, 폰이
  붙으면 나머지 13종이 동적 등록된다(5-D).
- ❌ `devicectl`/`adb` 등 device-control로 폰을 발사. 진입은 QR 스캔 단일 경로다(5-C).
- ❌ 환경 2(`relay-sandbox`)에서 `call_sdk`/`evaluate`로 실 SDK 호출 시도. SDK가 mock이라
  불가하다. 실 SDK fidelity가 필요하면 환경 3(intoss-private dogfood)으로 올라간다.
- ❌ 환경 2 진입 시 candidate scheme URL을 준비하려 `/ait deploy` 시작. 환경 2는
  candidate 번들 불필요 — `dev:phone:cdp` 스크립트 + `tunnel:{cdp:true}` 배선이 있으면 된다.
- ❌ 환경 2에서 `pnpm dev` 또는 `pnpm dev:phone`(screen-only)으로 dev 서버를 띄우거나
  기동을 권장. CDP relay(`AIT_RELAY_BASE_URL`/`AIT_TUNNEL_BASE_URL`)는 `AIT_TUNNEL_CDP=1`일 때만
  boot된다 — 이 skill은 `pnpm dev:phone:cdp`를 백그라운드로 자동 기동한다(5-C 1단계).
- ❌ 환경 2 relay 배선 없이 `relay-sandbox` 진입 기대. 기본 데몬은 런타임에
  `relay-sandbox` 외부 relay 패밀리를 lazy-boot하지만, `/ait setup-phone-preview` +
  `pnpm dev:phone:cdp`로 relay 주소(`.ait_urls`/`AIT_RELAY_BASE_URL`)를 먼저 채워야
  한다. 주소가 없으면 `start_debug`가 relay 주소 미설정 에러를 돌려준다 — 데몬
  재시작이 아니라 환경 2 배선이 해법이다(5-A 주의사항 참조).
- ❌ `.ait_urls` 파일 내용(URL 값)을 읽거나 로그·메시지에 출력. 존재 여부만 확인한다(5-C 2단계).
- ❌ 시크릿/인증 코드 값을 stdout·로그·메시지에 출력.
- ❌ `window.__ait`의 메서드명을 고정으로 단정. 버전에 따라 다를 수 있으니 객체를
  펼쳐 확인하도록 안내.
- ❌ 미구현 mock의 throw를 "버그"로 오인. 의도된 동작이며 누락 API는 devtools
  이슈로 보고 안내.
- ❌ 메시지에 "공식(official)", "토스가 제공하는", "powered by Toss" 등
  제휴·후원·인증 암시 표현.
- ❌ `MCP_ENV` 기반 구버전 진입 방식에 의존. 환경 전환은 `start_debug({mode})`로
  런타임에 한다 — 서버 재구동이 필요 없고 `MCP_ENV`를 미리 설정할 필요도 없다(5-A).
- ❌ `ait build`/`ait deploy` 대신 `aitcc`로 번들 빌드 시도. `ait`(번들러)와
  `aitcc`(콘솔 자동화)는 별개 도구다(5-B).

## 다음 단계 (관찰 결과에 따라 분기)

- **환경 1에서 재현·진단 끝** → 수정은 에이전트의 일반 편집 흐름으로. 브라우저에서
  재현되지 않고 실기기 엔진 fidelity가 의심되면 먼저 `/ait setup-phone-preview`로
  환경 2(AITC Sandbox App (PWA))를 배선한다(토스 앱 deploy 불필요, 실기기 WebKit 엔진
  확인 가능). 배선 후 `/ait debug`를 다시 실행하면 이 skill이 `pnpm dev:phone:cdp`를
  자동 기동하고 `start_debug({mode:'relay-sandbox'})` → 5-C relay-sandbox 경로를 진행한다.
  실 SDK fidelity(토스 WebView·네이티브 브리지)가 필요한 회귀라면 환경 3으로:
  `/ait deploy`로 candidate를 만들고 5-C의 QR attach.
- **candidate scheme URL이 아직 없음** → `/ait setup-bundle` → `/ait register` →
  `/ait deploy`로 candidate를 만든 뒤 다시 `/ait debug`.
- **`start_debug` 호출 후 `build_attach_url` 스캔 대기 중** → 폰 카메라로 QR 스캔.
  attach 후 `list_pages`로 확인 → 페이지가 보이면 5-D의 13종 도구로 디버깅 시작.
- **attach 후 미니앱에 `*.phone.test.ts` 테스트가 있으면** → `run_tests({ files: ["**/*.phone.test.ts"], projectRoot: "<프로젝트 루트>" })`로 실기기에서 실행 (5-E). 환경 4(relay-live)에서는 `confirm: true` 필수.
- **attach는 됐는데 도구가 아직 안 보임** → `notifications/tools/list_changed`가
  Claude Code에 전달되기까지 수 초 걸릴 수 있다. 잠시 후 에이전트의 도구 목록을
  다시 확인. 여전히 없으면 `get_debug_status`로 현재 환경/모드·relay 연결 상태 점검.
- **환경 4(LIVE) 운영 관측** → `/ait status`, `/ait logs`로 콘솔 상태도 함께 확인.

## 참고

- 짝 skill: `inject-devtools` (panel 설정), `setup-phone-preview` (환경 2(AITC Sandbox App (PWA)) 인프라 배선 — `tunnel:{cdp:true}` + cloudflared 터널 기동. `/ait debug` relay-sandbox의 선행 단계).
- 환경 4겹 × fidelity 설계 정본: umbrella `meta/four-environments-fidelity.md` (§1 환경 모델, §5 동적 도구 등록, §7 CDP 단일 transport).
- 환경 3·4 진입 시나리오 + QR relay 흐름: https://github.com/apps-in-toss-community/devtools/blob/main/docs/scenarios/env-3.md
- dogfood relay 루프 (candidate 빌드 → QR 스캔 → attach → 관측 사이클): https://github.com/apps-in-toss-community/devtools/blob/main/docs/dogfood-relay-loop.md
- devtools (mock + panel + MCP): https://github.com/apps-in-toss-community/devtools
- devtools live demo: https://devtools.aitc.dev/
- on-device debug (CDP relay MCP): `@ait-co/devtools` `./in-app` + `./mcp` + `devtools-mcp` bin. plugin manifest `mcpServers."ait-devtools"`가 `npx -y @ait-co/devtools devtools-mcp`로 기동.
- env-2 부트스트랩 설계 근거 (approach B): https://github.com/apps-in-toss-community/devtools/issues/428
- 커뮤니티 docs — lifecycle 디버깅(swipe-back 등): https://docs.aitc.dev/guides/navigation-flow
- 커뮤니티 docs — on-device CDP relay 디버깅 구조·진입 경로: https://docs.aitc.dev/guides/debug-relay
- 커뮤니티 docs — relay TOTP 인증(터널 URL 유출 차단): https://docs.aitc.dev/guides/relay-auth-totp
- 환경 4겹 설계: github.com/apps-in-toss-community/CLAUDE.md §1.1 + meta/four-environments-fidelity.md
