---
name: auth-setup
description: |
  Wire up oidc-bridge authentication into the current project — guides the
  user through calling `appLogin()`, exchanging the authorization code via
  oidc-bridge, and optionally wiring a Firebase Custom Token. Triggered by
  `/ait auth-setup`.
argument-hint: '[--firebase] [--bridge-url <url>]'
---

# auth-setup skill

## 목적

`/ait auth-setup` 한 번으로 사용자 프로젝트에 **토스 로그인 → oidc-bridge 교환 → (선택) Firebase Custom Token** 흐름을 설정한다.

이 흐름은 커뮤니티 오픈소스다. "공식 토스 로그인 SDK", "토스가 제공하는" 같은 표현은 사용하지 않는다. `@apps-in-toss/web-framework`는 원본 SDK 이름이라 그대로 사용한다.

> **live 검증 상태**: 커뮤니티 공용 인스턴스(`oidc-bridge.aitc.dev`)는 운영 중.
> 앱인토스 네이티브 환경에서의 end-to-end 검증은 진행 중이다.

## 의존

- `@apps-in-toss/web-framework` — 원본 SDK (`appLogin()` 제공). 프로젝트에 이미 설치되어 있어야 한다.
- `oidc-bridge` 인스턴스 — 커뮤니티 공용(`https://oidc-bridge.aitc.dev`) 또는 자체 호스팅.
  - 공용 인스턴스는 `/verify` 엔드포인트만 제공. `/firebase-token`은 501 반환 — Firebase 경로는 self-host 필수.
- (Firebase 경로만) Firebase 프로젝트 + `firebase` JS SDK.

## 실행 순서

### 1. 인수 파싱

| 인수 | 기본값 | 설명 |
|---|---|---|
| `--firebase` | false | Firebase Custom Token 경로 포함 여부 |
| `--bridge-url <url>` | `https://oidc-bridge.aitc.dev` | oidc-bridge 인스턴스 URL |

인수 없이 호출되면 기본값(공용 인스턴스, Firebase 없음)으로 진행한다.

### 2. SDK 설치 확인

```bash
grep -r '@apps-in-toss/web-framework' package.json 2>/dev/null | head -1
```

없으면:

```
@apps-in-toss/web-framework가 package.json에 없습니다.

설치:
  pnpm add @apps-in-toss/web-framework

설치 후 다시 /ait auth-setup을 호출해주세요.
```

있으면 다음 단계로.

### 3. appLogin() 호출 코드 안내

```ts
import { appLogin } from '@apps-in-toss/web-framework';

// 앱인토스 미니앱 안에서 호출 — 토스 앱이 로그인 UI를 처리한다.
const { authorizationCode } = await appLogin();
// authorizationCode는 단기 일회용 코드 — 바로 서버/bridge로 교환해야 한다.
```

개발 중 토스 앱 없이 브라우저에서 테스트하려면 `@ait-co/devtools` unplugin을 함께 사용한다 (`/ait inject-devtools` 참고).

### 4. oidc-bridge `/verify` 교환

`authorizationCode`를 서버 또는 클라이언트에서 bridge로 교환한다.

**권장: 서버 사이드 교환** (authorizationCode가 클라이언트 로그에 노출되지 않음).
단순 demo나 개발 중에는 클라이언트에서도 동작한다.

```ts
const BRIDGE_URL = 'https://oidc-bridge.aitc.dev'; // 또는 --bridge-url 값

const response = await fetch(`${BRIDGE_URL}/verify`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    authorizationCode,
    referrer: 'DEFAULT', // 샌드박스면 'SANDBOX'
  }),
});

if (!response.ok) {
  const err = await response.json();
  throw new Error(`${err.error}: ${err.error_description}`);
}

const claims = await response.json();
// → { sub: string, provider: "toss", claims: {...}, tossAccessTokenExpiresAt: number }
// sub는 토스 사용자 고유 ID (stable across sessions)
```

`referrer` 값:
- `"DEFAULT"` — production / 실제 앱인토스 환경
- `"SANDBOX"` — devtools sandbox (토스 앱 없이 테스트할 때)

### 5. (선택) Firebase Custom Token 경로 — `--firebase`

`--firebase` 인수가 있을 때만 안내한다.

> `/firebase-token` 엔드포인트는 **self-host 전용**이다. 커뮤니티 공용 인스턴스
> (`oidc-bridge.aitc.dev`)는 Firebase 서비스 계정을 보관하지 않아 501을 반환한다.
> 이 경로가 필요하면 oidc-bridge를 직접 배포해야 한다.

**self-host oidc-bridge 환경 변수**:

```bash
FIREBASE_SERVICE_ACCOUNT='{"type":"service_account",...}' # Firebase 콘솔에서 발급
ALLOWED_ORIGINS=https://your-app.example.com
```

**클라이언트 코드**:

```ts
import { signInWithCustomToken, getAuth } from 'firebase/auth';

const BRIDGE_URL = 'https://your-own-bridge.example.com'; // self-host URL

const { authorizationCode } = await appLogin();
const response = await fetch(`${BRIDGE_URL}/firebase-token`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ authorizationCode, referrer: 'DEFAULT' }),
});
const { firebaseToken, sub } = await response.json();
// → { firebaseToken: string, sub: string, provider: "toss", claims: {...}, ... }

// Firebase Auth에 로그인
await signInWithCustomToken(getAuth(), firebaseToken);
```

### 6. 검증 안내

**개발 중 (devtools sandbox)**:
1. `pnpm dev` — devtools mock이 `appLogin()`을 intercept해 sandbox authorizationCode 반환
2. `/verify` 호출 시 `referrer: "SANDBOX"` 사용
3. 브라우저 콘솔에서 `claims.sub` 확인

**앱인토스 네이티브 검증**:
1. `aitcc` CLI로 배포 (`/ait deploy` 참고)
2. 토스 앱에서 미니앱 열기 → `appLogin()` 실행 → `referrer: "DEFAULT"`로 교환
3. 반환된 `claims.sub`가 실제 토스 계정 ID인지 확인

sdk-example의 Auth 페이지(`AuthPage → OidcBridgeSection`)에서 인터랙티브하게 테스트해볼 수 있다:
- `POST /verify` 카드: appLogin() + 교환 한 번에 실행
- `POST /firebase-token` 카드: self-host 전용 (공용 인스턴스에서는 501)

## 하지 말아야 할 것

- `authorizationCode`를 로그·URL·localStorage에 그대로 저장하지 말 것 — 단기 일회용 코드다.
- `/firebase-token`을 공용 인스턴스 URL로 호출하도록 안내하지 말 것 — 항상 self-host임을 명시.
- `appLogin()` 없이 authorizationCode를 하드코딩하는 예제 금지.
- "공식 토스 로그인", "토스가 제공하는 auth" 등 제휴 암시 표현 금지.

## 참고

- oidc-bridge repo: https://github.com/apps-in-toss-community/oidc-bridge
- 커뮤니티 공용 인스턴스: `https://oidc-bridge.aitc.dev`
- sdk-example AuthPage (실제 dog-food 패턴): https://github.com/apps-in-toss-community/sdk-example/blob/main/src/pages/AuthPage.tsx
- 짝 skill: `inject-devtools` (sandbox 환경에서 `appLogin()` mock 제공)
- 짝 skill: `deploy` (앱인토스에 배포해 native 검증)
