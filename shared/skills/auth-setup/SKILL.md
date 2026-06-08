---
name: auth-setup
description: |
  Wire up oidc-bridge authentication into the current project — guides the
  user through calling `appLogin()`, exchanging the authorization code via
  a consumer backend that calls oidc-bridge `/oidc/token`, and signing in
  with the resulting `id_token` (Supabase or Firebase). Triggered by
  `/ait auth-setup`.
argument-hint: '[--firebase] [--bridge-url <url>]'
---

# auth-setup skill

## 목적

`/ait auth-setup` 한 번으로 사용자 프로젝트에 **토스 로그인 → consumer backend → oidc-bridge `/oidc/token` 교환 → id_token으로 로그인** 흐름을 설정한다.

이 흐름은 커뮤니티 오픈소스다. "공식 토스 로그인 SDK", "토스가 제공하는" 같은 표현은 사용하지 않는다. `@apps-in-toss/web-framework`는 원본 SDK 이름이라 그대로 사용한다.

커뮤니티 공용 인스턴스(`oidc-bridge.aitc.dev`)는 운영 중이며, 앱인토스 네이티브 환경에서의 end-to-end 검증은 진행 중이다.

## 아키텍처 요약 (M5 flow)

미니앱은 bridge를 **직접 호출하지 않는다**. 올바른 흐름:

```
mini-app → appLogin() → authorizationCode
         → POST /your-backend (authorizationCode)
             → backend calls bridge POST /oidc/token
             ← bridge returns { access_token, id_token, ... }
         ← backend returns { id_token }
         → client signInWithIdToken(id_token)  ← Supabase 또는 Firebase
```

mini-app이 bridge를 직접 호출하도록 안내하지 말 것. bridge는 등록된 앱 단위로 caller를 인증한다(public client는 Origin allow-list, confidential client는 `client_secret`). 이 인증은 서버 사이드에서 이루어져야 한다.

## 의존

- `@apps-in-toss/web-framework` — 원본 SDK (`appLogin()` 제공). 프로젝트에 이미 설치되어 있어야 한다.
- **consumer backend** — mini-app이 authorizationCode를 넘길 서버 사이드 엔드포인트. Supabase Edge Function, Next.js API route, Cloudflare Worker 등 어느 것이든 가능.
- `oidc-bridge` 인스턴스 — 커뮤니티 공용(`https://oidc-bridge.aitc.dev`) 또는 자체 호스팅.
  - bridge의 `/verify` 엔드포인트는 **제거됨**(HTTP 404). 반드시 `/oidc/token`을 사용할 것.
  - `/firebase-token`은 self-host 전용 — Firebase 서비스 계정을 공용 인스턴스에 저장하지 않음(501 반환).
- (Supabase 경로) Supabase 프로젝트 + `@supabase/supabase-js`.
- (Firebase 경로, `--firebase`) Firebase 프로젝트 + `firebase` JS SDK.

## 실행 순서

### 1. 인수 파싱

| 인수 | 기본값 | 설명 |
|---|---|---|
| `--firebase` | false | Firebase OIDC 로그인 경로 포함 여부 (기본값: Supabase) |
| `--bridge-url <url>` | `https://oidc-bridge.aitc.dev` | oidc-bridge 인스턴스 URL |

인수 없이 호출되면 기본값(공용 인스턴스, Supabase 경로)으로 진행한다.

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

### 2.5 사전 조건 확인 — bridge client_id · provider

코드를 쓰기 전에, 아래 세 가지는 harness가 자동 생성하지 못하는 **외부 발급/설정**이다. 빠진 게 있으면 먼저 채우도록 안내한다(자동화하지 않고 경로만 인쇄 — 절벽이 아니라 seam):

```
auth-setup 사전 조건 (없으면 먼저 준비):

  1. oidc-bridge client_id
     - 공용 인스턴스(https://oidc-bridge.aitc.dev) 또는 자체 호스팅 bridge에
       이 미니앱을 등록하고 client_id를 발급받는다.
     - public client는 Origin allow-list, confidential client는 client_secret로
       caller를 인증한다(§의존 참조). 발급 방법은 oidc-bridge 문서를 따른다:
       https://github.com/apps-in-toss-community/oidc-bridge

  2. (Supabase 경로) Supabase 프로젝트 + OIDC provider
     - Supabase 대시보드 Auth 설정에서 bridge를 OIDC provider로 등록한다.
     - VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY를 .env에 둔다.

  3. consumer backend 배포 위치
     - authorizationCode를 교환할 서버 사이드 엔드포인트(Supabase Edge Function /
       Next.js API route / Cloudflare Worker 등). 아래 4단계가 그 코드를 안내한다.
```

이 값들은 아래 코드의 `OIDC_BRIDGE_CLIENT_ID`·Supabase 환경변수에 들어간다. placeholder를 그대로 두면 런타임에서 인증이 실패하므로, 코드 생성 시 어느 값을 실제 발급 값으로 채워야 하는지 명시한다.

### 3. appLogin() 호출 코드 안내

```ts
import { appLogin } from '@apps-in-toss/web-framework';

// 앱인토스 미니앱 안에서 호출 — 토스 앱이 로그인 UI를 처리한다.
const { authorizationCode } = await appLogin();
// authorizationCode는 단기 일회용 코드 — 즉시 백엔드로 전달해야 한다.
// 클라이언트에서 bridge를 직접 호출하지 말 것.
```

개발 중 토스 앱 없이 브라우저에서 테스트하려면 `@ait-co/devtools` unplugin을 함께 사용한다 (`/ait inject-devtools` 참고).

### 4. consumer backend 구현 — bridge `POST /oidc/token` 교환

mini-app은 authorizationCode를 **자신의 백엔드**로 전달하고, 백엔드가 bridge를 호출한다.

**백엔드 코드 예 (Supabase Edge Function / Deno)**:

```ts
// supabase/functions/toss-login/index.ts
// 필수 환경변수(supabase secrets set으로 설정):
//   OIDC_BRIDGE_BASE_URL   e.g. https://oidc-bridge.aitc.dev
//   OIDC_BRIDGE_CLIENT_ID  bridge에 등록된 client_id
//   OIDC_BRIDGE_CLIENT_SECRET  (optional) confidential client만

Deno.serve(async (req) => {
  const { authorizationCode, referrer } = await req.json();

  const baseUrl = Deno.env.get('OIDC_BRIDGE_BASE_URL');
  const clientId = Deno.env.get('OIDC_BRIDGE_CLIENT_ID');
  const clientSecret = Deno.env.get('OIDC_BRIDGE_CLIENT_SECRET');

  const tokenRequest: Record<string, string> = {
    grant_type: 'authorization_code',
    code: authorizationCode,
    client_id: clientId,
    referrer: referrer ?? 'DEFAULT',
  };
  if (clientSecret) tokenRequest.client_secret = clientSecret;

  const res = await fetch(`${baseUrl}/oidc/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(tokenRequest),
  });
  const tokens = await res.json();
  // tokens: { access_token, refresh_token, id_token, token_type: "Bearer",
  //            expires_in, scope }

  if (!res.ok) {
    return Response.json({ error: tokens.error, error_description: tokens.error_description }, { status: res.status });
  }
  // 클라이언트에는 id_token만 반환하면 충분
  return Response.json({ id_token: tokens.id_token, expires_in: tokens.expires_in });
});
```

**bridge `/oidc/token` 요청 형태**:

```jsonc
POST /oidc/token
Content-Type: application/json

{
  "grant_type": "authorization_code",
  "code": "<authorizationCode>",
  "client_id": "<registered client_id>",
  "referrer": "DEFAULT",           // "SANDBOX" for dev sandbox
  "client_secret": "<secret>"      // confidential client만; public은 생략
}
```

**응답 형태** (성공 시):

```jsonc
{
  "access_token": "...",
  "refresh_token": "...",
  "id_token": "...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "scope": "openid profile"
}
```

`referrer` 값:
- `"DEFAULT"` — production / 실제 앱인토스 환경
- `"SANDBOX"` — devtools sandbox (토스 앱 없이 테스트할 때)

### 5. 클라이언트 — id_token으로 로그인

백엔드에서 `id_token`을 받으면 클라이언트에서 인증 공급자에 로그인한다.

**Supabase (기본 경로)**:

```ts
import { appLogin } from '@apps-in-toss/web-framework';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
);

// Step 1: get authorizationCode
const { authorizationCode } = await appLogin();

// Step 2: exchange via your backend
const res = await fetch('/functions/v1/toss-login', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ authorizationCode, referrer: 'DEFAULT' }),
});
const { id_token } = await res.json();

// Step 3: sign in to Supabase with the OIDC id_token
const { data, error } = await supabase.auth.signInWithIdToken({
  provider: 'oidc',
  token: id_token,
});
```

**Firebase (`--firebase` 경로)**:

```ts
import { signInWithPopup, OAuthProvider, getAuth } from 'firebase/auth';

// Firebase 프로젝트에서 OIDC provider를 등록해야 한다.
// issuer: https://oidc-bridge.aitc.dev (또는 self-host URL)
const provider = new OAuthProvider('oidc.<your-provider-id>');
// id_token을 credential로 변환
const credential = provider.credential({ idToken: id_token });
await signInWithPopup(getAuth(), credential);
// 또는 signInWithCredential(getAuth(), credential)
```

### 6. 검증 안내

**개발 중 (devtools sandbox)**:
1. `pnpm dev` — devtools mock이 `appLogin()`을 intercept해 sandbox authorizationCode 반환
2. 백엔드 `/oidc/token` 호출 시 `referrer: "SANDBOX"` 사용
3. 반환된 `id_token`을 디코딩(JWT)해 `sub` claim 확인

**앱인토스 네이티브 검증**:
1. `aitcc` CLI로 배포 (`/ait deploy` 참고)
2. 토스 앱에서 미니앱 열기 → `appLogin()` 실행 → 백엔드가 `referrer: "DEFAULT"`로 교환
3. `id_token`의 `sub` claim이 실제 토스 계정 ID인지 확인

sdk-example의 Auth 페이지(`AuthPage → OidcBridgeSection`)에서 `/oidc/token` 흐름을 인터랙티브하게 테스트해볼 수 있다.

### 7. 완료 요약 + 다음 단계

배선 완료 후 한 블록으로 마무리한다:

```
auth-setup 완료

배선된 것:
  - appLogin() → consumer backend → bridge /oidc/token → signInWithIdToken
  - bridge URL: <bridge-url> (기본 https://oidc-bridge.aitc.dev)

다음 단계:
  pnpm dev            # devtools sandbox에서 appLogin() mock으로 흐름 확인
  /ait deploy         # 앱인토스에 배포해 native end-to-end 검증
  /ait status         # 배포 후 콘솔 상태 확인
```

native 검증은 배포가 선행되어야 하므로, sandbox 확인이 끝나면 `/ait deploy`로 넘어간다.

## 하지 말아야 할 것

- `authorizationCode`를 로그·URL·localStorage에 그대로 저장하지 말 것 — 단기 일회용 코드다.
- mini-app(클라이언트)에서 bridge를 **직접** 호출하도록 안내하지 말 것 — 항상 consumer backend를 경유한다.
- `/verify` 엔드포인트를 사용하도록 안내하지 말 것 — 해당 엔드포인트는 제거됨(HTTP 404).
- `/firebase-token`을 공용 인스턴스 URL로 호출하도록 안내하지 말 것 — self-host 전용임을 명시.
- `appLogin()` 없이 authorizationCode를 하드코딩하는 예제 금지.
- "공식 토스 로그인", "토스가 제공하는 auth" 등 제휴 암시 표현 금지.

## 참고

- 커뮤니티 docs — 토스 로그인 흐름: https://docs.aitc.dev/guides/auth-flow
- oidc-bridge repo: https://github.com/apps-in-toss-community/oidc-bridge
- 커뮤니티 공용 인스턴스: `https://oidc-bridge.aitc.dev`
- sdk-example 레퍼런스 구현: `supabase/functions/toss-login/index.ts` + `src/snippets/auth/oidcExchange.ts`
- sdk-example AuthPage (실제 dog-food 패턴): https://github.com/apps-in-toss-community/sdk-example/blob/main/src/pages/AuthPage.tsx
- 짝 skill: `inject-devtools` (sandbox 환경에서 `appLogin()` mock 제공)
- 짝 skill: `deploy` (앱인토스에 배포해 native 검증)
