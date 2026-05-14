---
name: setup-phone-preview
description: |
  Wire up the devtools quick-tunnel + launcher PWA flow into the current project
  so you can preview the dev app on a real phone. Patches vite.config.ts
  (adds tunnel option), package.json (adds dev:phone script + cloudflared to
  pnpm.onlyBuiltDependencies), and runs pnpm install so the cloudflared binary
  is cached before the first run. All changes are idempotent — safe to run more
  than once. Triggered by `/ait setup-phone-preview`. 비공식 커뮤니티 플러그인 —
  토스/앱인토스 팀 공식 도구가 아님.
argument-hint: ''
---

# setup-phone-preview skill

## 목적

`/ait setup-phone-preview` 한 번으로 **실기기(폰) 미리보기** 환경을 준비한다.

devtools `tunnel` 옵션([`@ait-co/devtools@^0.1.19`](https://github.com/apps-in-toss-community/devtools))은
Vite dev server가 뜰 때 Cloudflare quick tunnel을 자동으로 열고, 터미널에
`*.trycloudflare.com` URL + ASCII QR을 출력한다. 이 URL을 launcher PWA
(`https://devtools.aitc.dev/launcher/`) 안에서 열면 폰 홈 화면에 고정된
앱처럼 실행된다.

이 skill이 완료되면:
- `pnpm dev:phone` 한 번으로 터미널에 URL + QR이 뜬다.
- 폰에서 launcher PWA를 홈 화면에 한 번 추가해두면 매일 QR 스캔만으로 새 tunnel URL에 접속된다.
- `pnpm dev`(기존 명령)는 변경 없음 — tunnel은 `dev:phone`을 쓸 때만 켜진다.

> 이 프로젝트는 토스/앱인토스 팀과 제휴되지 않은 비공식 오픈소스 커뮤니티의
> 플러그인이다. 생성·수정하는 모든 파일에서 "공식(official)", "토스가 제공하는",
> "powered by Toss" 등 제휴·후원·인증 암시 표현을 쓰지 않는다.

## 의존

- **Vite 프로젝트**여야 한다 (`vite.config.ts` 또는 `vite.config.js`가 cwd에 있어야 함).
- **`@ait-co/devtools`가 이미 devDependencies에 있어야 한다** (버전 `^0.1.19` 이상).
  - 없으면 먼저 `/ait inject-devtools`를 실행하도록 안내하고 중단.
  - 있지만 `^0.1.12` 이하면 `pnpm add -D @ait-co/devtools@^0.1.19`로 업그레이드.
- **pnpm**이 패키지 매니저여야 한다 (`pnpm-lock.yaml` 존재 확인).
  - npm/yarn/bun 프로젝트는 `package.json` 패치(step 3)의 `pnpm.onlyBuiltDependencies` 필드가 해당 매니저에서 무의미하므로 사용자에게 그 점을 알리고 skip한다.

> 이 skill은 콘솔 인증을 **요구하지 않는다**. tunnel은 로컬 dev 전용.

## 실행 순서

### 1. 사전 조건 확인

```bash
ls package.json vite.config.ts vite.config.js 2>/dev/null
```

`package.json`이 없으면:

```
package.json이 없습니다. 프로젝트 루트 디렉토리에서 다시 실행해주세요.
예: cd <project-root> && /ait setup-phone-preview
```

중단.

`vite.config.ts` / `vite.config.js`가 없으면:

```
setup-phone-preview는 Vite 프로젝트 전용입니다.
vite.config.ts(또는 .js)가 프로젝트 루트에 있어야 합니다.

Next.js / Rspack / Webpack 프로젝트에서 cloudflared tunnel을 쓰려면
직접 cloudflared CLI를 설치하고 tunnel을 열어주세요:
  https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/
```

중단.

`@ait-co/devtools`가 `package.json`의 `devDependencies`에 없으면:

```
@ait-co/devtools가 devDependencies에 없습니다.
먼저 devtools unplugin을 설치해주세요:
  /ait inject-devtools

inject-devtools 완료 후 다시 /ait setup-phone-preview를 실행해주세요.
```

중단.

### 2. `vite.config.ts` 패치 — `tunnel` 옵션 주입 (idempotent)

`vite.config.ts`(없으면 `vite.config.js`)를 `Read`로 읽는다.

**idempotency 체크**: 파일 내용에 `tunnel` 문자열이 있으면:

```
vite.config.ts에 이미 tunnel 설정이 있습니다. 이 단계를 건너뜁니다.
```

없으면 `aitDevtools.vite(...)` 호출을 찾아 `tunnel: !!process.env.AIT_TUNNEL` 옵션을 추가한다.

**패턴: `aitDevtools.vite()` — 인수 없음**

```ts
// 변경 전
aitDevtools.vite()

// 변경 후
aitDevtools.vite({ tunnel: !!process.env.AIT_TUNNEL })
```

**패턴: `aitDevtools.vite({ ... })` — 기존 옵션 객체 있음**

기존 객체에 `tunnel: !!process.env.AIT_TUNNEL`을 추가한다.

```ts
// 변경 전
aitDevtools.vite({ panel: true })

// 변경 후
aitDevtools.vite({ panel: true, tunnel: !!process.env.AIT_TUNNEL })
```

**`aitDevtools.vite(...)` 호출을 찾을 수 없는 경우**: `Read`로 파일 전체를 확인하고 사용자에게 수동 추가를 안내한다:

```
vite.config.ts에서 aitDevtools.vite() 호출을 찾을 수 없습니다.
수동으로 tunnel 옵션을 추가해주세요:

  aitDevtools.vite({ tunnel: !!process.env.AIT_TUNNEL })

추가 후 다시 /ait setup-phone-preview를 실행하거나, 다음 단계부터 수동으로 진행하세요.
```

**수정 원칙**: `Edit` tool로 최소 변경. 기존 코드 포맷·주석·설정은 유지.

### 3. `package.json` 패치 — `pnpm.onlyBuiltDependencies` + `dev:phone` (idempotent)

`package.json`을 JSON.parse로 읽어 두 가지를 idempotent하게 적용한다.

#### 3-a. `pnpm.onlyBuiltDependencies`에 `cloudflared` 추가

이 필드는 `cloudflared` postinstall(`~38 MB` 바이너리 다운로드)이 pnpm의
[`onlyBuiltDependencies`](https://pnpm.io/package_json#pnpmonlybuiltdependencies)
보안 게이트를 통과하게 해준다.

- `pnpm.onlyBuiltDependencies` 배열이 없으면 신설.
- 이미 있으면 `cloudflared`가 배열에 있는지 확인, 없으면 추가, 있으면 skip.

**결과 예**:

```json
{
  "pnpm": {
    "onlyBuiltDependencies": ["cloudflared"]
  }
}
```

기존에 다른 항목이 있으면 병합:

```json
{
  "pnpm": {
    "onlyBuiltDependencies": ["@parcel/watcher", "cloudflared"]
  }
}
```

#### 3-b. `scripts.dev:phone` 추가

- `scripts["dev:phone"]`이 없으면 추가: `"AIT_TUNNEL=1 vite"`.
- 이미 있으면 skip:

```
scripts.dev:phone이 이미 있습니다. 이 단계를 건너뜁니다.
```

수정된 JSON을 파일에 다시 쓸 때는 `JSON.stringify(pkg, null, 2) + '\n'`으로
2-space indent + newline 유지. 주석(JSON5) 불필요 — 기존 파일이 표준 JSON이면
그대로.

**pnpm이 아닌 경우** (`pnpm-lock.yaml`이 없고 npm/yarn/bun lockfile만 있을 때):
`pnpm.onlyBuiltDependencies` 패치는 건너뛰고 사용자에게 알린다:

```
pnpm.onlyBuiltDependencies는 pnpm 전용 필드입니다.
npm/yarn/bun 프로젝트는 이 필드가 효과 없으므로 건너뜁니다.

cloudflared 바이너리가 postinstall에서 실패하면 다음을 실행해보세요:
  npx cloudflared --version   # 또는 brew install cloudflared
```

`scripts.dev:phone` 추가는 매니저 무관하게 진행.

### 4. `pnpm install` 실행 — cloudflared 바이너리 사전 캐시

```bash
pnpm install
```

cloudflared postinstall이 바이너리를 다운로드한다(~38 MB, 첫 실행 1회만). 이미
캐시된 경우 빠르게 통과.

설치가 실패하면(네트워크 등):

```
pnpm install 중 오류가 발생했습니다. 네트워크 연결을 확인해주세요.
수동으로 실행하려면:
  pnpm install
```

### 5. 완료 안내

모든 단계 완료 후 안내 블록을 한 번에 출력:

---

```
setup-phone-preview 완료

변경 내용:
  - vite.config.ts: aitDevtools.vite({ tunnel: !!process.env.AIT_TUNNEL }) 추가
  - package.json: pnpm.onlyBuiltDependencies에 cloudflared 추가
  - package.json: scripts.dev:phone 추가 ("AIT_TUNNEL=1 vite")
  - pnpm install 완료 (cloudflared 바이너리 캐시됨)

[폰에서 한 번만 하는 준비]
  https://devtools.aitc.dev/launcher/ 를 Safari/Chrome에서 열어
  홈 화면에 추가하세요.
    iOS Safari: 공유 버튼 → "홈 화면에 추가"
    Android Chrome: ⋮ → "앱 설치" 또는 "홈 화면에 추가"

  이 launcher는 URL이 고정되어 있어 매일 다시 설치할 필요 없습니다.

[매일 실행]
  pnpm dev:phone

  터미널에 quick tunnel URL + QR이 출력됩니다.
  launcher PWA에서 QR을 스캔하거나 URL을 붙여넣으면
  폰에서 dev 앱이 full-screen으로 열립니다.

참고:
  - tunnel URL은 실행마다 바뀝니다 (*.trycloudflare.com, 인증 없음).
  - tunnel은 pnpm dev에는 영향 없습니다 (AIT_TUNNEL=1 일 때만 켜짐).
  - 문서: https://github.com/apps-in-toss-community/devtools
```

---

영어 안내 (영어권 사용자가 물어보면 같은 정보를 영어로):

---

```
setup-phone-preview done

Changes applied:
  - vite.config.ts: added tunnel: !!process.env.AIT_TUNNEL to aitDevtools.vite()
  - package.json: added cloudflared to pnpm.onlyBuiltDependencies
  - package.json: added scripts.dev:phone ("AIT_TUNNEL=1 vite")
  - pnpm install finished (cloudflared binary cached)

[One-time phone setup]
  Open https://devtools.aitc.dev/launcher/ on your phone and add it to
  your home screen.
    iOS Safari: Share → "Add to Home Screen"
    Android Chrome: ⋮ → "Install app" or "Add to Home Screen"

  The launcher URL is fixed — you only need to install it once.

[Daily workflow]
  pnpm dev:phone

  A quick tunnel URL + QR code will appear in the terminal.
  Scan the QR (or paste the URL) in the launcher PWA to open the dev app
  full-screen on your phone.

Notes:
  - The tunnel URL changes every run (*.trycloudflare.com, unauthenticated).
  - pnpm dev is unchanged — the tunnel only starts when AIT_TUNNEL=1.
  - Docs: https://github.com/apps-in-toss-community/devtools
```

---

> **폰 PWA install은 OS gesture가 필요**해 자동화할 수 없다.
> 이 skill은 **데스크톱 셋업까지만** 책임진다 — launcher 홈화면 추가는 사용자가 직접.

## Out of scope (이 skill이 하지 않는 것)

- ❌ `@ait-co/devtools` 신규 설치 — `/ait inject-devtools` skill.
- ❌ Next.js / Rspack / Webpack 프로젝트 — Vite 전용. 다른 빌드 도구는 cloudflared CLI 직접 사용.
- ❌ 실제 tunnel URL 확인·연결 테스트 — `pnpm dev:phone` 직접 실행 후 확인.
- ❌ launcher PWA 홈화면 추가 자동화 — OS gesture 필요, 수동.
- ❌ 콘솔 인증·배포 — 별도 skill (`/ait deploy`).
- ❌ `pnpm.onlyBuiltDependencies` 외 다른 pnpm 설정 변경.
- ❌ cloudflare 계정 설정 / 유료 tunnel — quick tunnel만 (인증·계정 불필요).

## 하지 말아야 할 것

- ❌ `vite.config.ts`를 완전히 재작성. **최소 변경 only** (`Edit` tool).
- ❌ `tunnel: true`로 하드코딩. 반드시 `tunnel: !!process.env.AIT_TUNNEL`로 env-gate.
  (`pnpm dev`에서는 tunnel이 꺼져야 함.)
- ❌ `cloudflared`를 `devDependencies`에 직접 추가. `@ait-co/devtools`가 이미
  `dependencies`로 가져온다. `pnpm.onlyBuiltDependencies` 허용만 하면 됨.
- ❌ `package.json` JSON 주석 추가 (표준 JSON에 주석 불가).
- ❌ 생성·수정하는 내용에 "공식(official)", "토스가 제공하는", "powered by Toss"
  등 제휴·후원·인증 암시 표현.
- ❌ idempotency 체크 없이 중복 적용 — 2회 실행 시 변경이 없어야 한다.

## 짝 skill

- `inject-devtools` — `@ait-co/devtools` 신규 설치 + vite.config 기본 설정.
  `setup-phone-preview`보다 먼저 실행해야 한다.
- `inject-polyfill` — polyfill 병행 사용 시.
- `deploy` — tunnel 검증 후 앱인토스 배포.

## 참고

- devtools tunnel 구현 (PR #131): https://github.com/apps-in-toss-community/devtools/pull/131
- sdk-example wiring 사례 (PR #59): https://github.com/apps-in-toss-community/sdk-example/pull/59
- devtools README "Run on a real phone" 섹션: https://github.com/apps-in-toss-community/devtools
- launcher PWA: https://devtools.aitc.dev/launcher/
- cloudflared quick tunnel 문서: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/do-more-with-tunnels/trycloudflare/
- 커뮤니티: https://aitc.dev/
