---
name: auth-setup
description: |
  Wire up oidc-bridge login into the current project — `appLogin()` →
  consumer backend token exchange → sign-in with `id_token` (Supabase or
  Firebase). Use when the user asks "앱인토스/토스 로그인 연동해줘",
  "oidc-bridge로 Supabase/Firebase 인증 배선해줘". Triggered by
  `/ait:auth-setup [--firebase] [--bridge-url <url>]`.
argument-hint: '[--firebase] [--bridge-url <url>]'
---

# auth-setup skill

## 목적

`/ait:auth-setup` 한 번으로 사용자 프로젝트에 **토스 로그인 → consumer backend → oidc-bridge token 교환 → id_token으로 로그인** 흐름을 설정한다. self-host bridge는 루트 마운트라 token 엔드포인트가 `/oidc/token`이다.

이 흐름은 커뮤니티 오픈소스다. "공식 토스 로그인 SDK", "토스가 제공하는" 같은 표현은 사용하지 않는다. `@apps-in-toss/web-framework`는 원본 SDK 이름이라 그대로 사용한다.

커뮤니티가 운영하던 공용 인스턴스(`oidc-bridge.aitc.dev`)는 `aitc.dev` 도메인 정리와 함께 종료된다 — 남는 경로는 self-host뿐이다. bridge 소스는 [`apps-in-toss-community/oidc-bridge`](https://github.com/apps-in-toss-community/oidc-bridge)에 그대로 남는다. 사용자가 bridge URL을 주지 않으면 기본값을 임의로 채우지 말고 self-host 인스턴스 주소를 물어본다.

**이 명령이 필요한가?** 사용자를 식별하거나 사용자별 데이터를 저장해야 하면 이 명령을 쓴다. 로그인이 전혀 필요 없는 앱이라면 건너뛰어도 된다:

```
/ait:setup-bundle    # 로그인 없이 번들 배포로 바로 건너뛰기
```

## 아키텍처 요약 (M5 flow)

미니앱은 bridge를 **직접 호출하지 않는다**. 올바른 흐름:

```
mini-app → appLogin() → authorizationCode
         → POST /your-backend (authorizationCode)
             → backend calls bridge POST /oidc/token  (self-host 루트 마운트)
             ← bridge returns { access_token, id_token, ... }
         ← backend returns { id_token }
         → client signInWithIdToken(id_token)  ← Supabase 또는 Firebase
```

mini-app이 bridge를 직접 호출하도록 안내하지 말 것. bridge는 등록된 앱 단위로 caller를 인증한다(public client는 Origin allow-list, confidential client는 `client_secret`). 이 인증은 서버 사이드에서 이루어져야 한다.

## 의존

- `@apps-in-toss/web-framework` — 원본 SDK (`appLogin()` 제공). 프로젝트에 이미 설치되어 있어야 한다.
- **consumer backend** — mini-app이 authorizationCode를 넘길 서버 사이드 엔드포인트. Supabase Edge Function, Next.js API route, Cloudflare Worker 등 어느 것이든 가능.
- `oidc-bridge` 인스턴스 — 자체 호스팅(self-host). 공용 인스턴스는 종료됐다. 소스: https://github.com/apps-in-toss-community/oidc-bridge
  - bridge의 `/verify` 엔드포인트는 **제거됨**(HTTP 404). 반드시 `/oidc/token`을 사용할 것.
  - `/firebase-token`은 미구현 — 호출해도 라우트가 없어 404. Firebase는 위 OIDC id_token 경로(`/oidc/token` → `signInWithCredential`)로 로그인한다. (Custom Token이 필요한 환경은 Firebase 서비스 계정을 custody하는 self-host bridge가 전제다.)
- (Supabase 경로) Supabase 프로젝트 + `@supabase/supabase-js`.
- (Firebase 경로, `--firebase`) Firebase 프로젝트 + `firebase` JS SDK.

## 실행 순서

### 1. 인수 파싱

| 인수 | 기본값 | 설명 |
|---|---|---|
| `--firebase` | false | Firebase OIDC 로그인 경로 포함 여부 (기본값: Supabase) |
| `--bridge-url <url>` | (없음 — 물어본다) | self-host oidc-bridge 인스턴스 URL |

`--bridge-url`이 없으면 사용자에게 self-host bridge 주소를 물어본다. 나머지는 기본값(Supabase 경로)으로 진행한다.

### 2. SDK 설치 확인

```bash
grep -r '@apps-in-toss/web-framework' package.json 2>/dev/null | head -1
```

없으면:

```
@apps-in-toss/web-framework가 package.json에 없습니다.

설치:
  pnpm add @apps-in-toss/web-framework

설치 후 다시 /ait:auth-setup을 호출해주세요.
```

있으면 다음 단계로.

### 2.5 사전 조건 확인 — bridge client_id · provider

코드를 쓰기 전에, 아래 세 가지는 harness가 자동 생성하지 못하는 **외부 발급/설정**이다. 빠진 게 있으면 먼저 채우도록 안내한다(자동화하지 않고 경로만 인쇄 — 절벽이 아니라 seam):

```
auth-setup 사전 조건 (없으면 먼저 준비):

  1. oidc-bridge client_id
     - 커뮤니티가 운영하던 공용 인스턴스는 종료됐다 — bridge를 직접 호스팅해야 한다.
       소스: https://github.com/apps-in-toss-community/oidc-bridge
     - 자체 호스팅 bridge에서는 `cli/commands/app.ts`의 `app create` 명령으로
       직접 발급한다 — 필수 플래그 5개
       (`--workspace-id <id> --app-id-toss <id> --title <title> --cert <path> --key <path>`,
       `--cert`·`--key`는 mTLS cert PEM 경로).
       self-host는 루트 마운트이므로 tenantId 없음 — token URL은 `/oidc/token`.
     - public client는 Origin allow-list, confidential client는 client_secret로
       caller를 인증한다(§의존 참조).

  2. (Supabase 경로) Supabase 프로젝트 + OIDC provider
     - 아래 링크에서 bridge를 OIDC provider로 등록한다:
       https://supabase.com/dashboard/project/_/auth/providers
       (URL의 `_`를 실제 project ref로 교체 — 프로젝트 Settings > General에서 확인)
     - 경로: Authentication > Sign In Methods > Custom OIDC > Add provider
     - 입력 필드:
       1. Issuer URL: <bridge-url>  (self-host 루트 마운트, tenantId 없음.
            discovery가 <issuer>/.well-known/openid-configuration으로 자동 완성됨)
       2. Client ID: <등록된 client_id>  (위 item 1에서 발급받은 값)
       3. Discovery URL은 자동 완성됨 (<issuer>/.well-known/openid-configuration)
     - 저장 후 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY를 .env에 둔다.

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

개발 중 토스 앱 없이 브라우저에서 테스트하려면 `@ait-co/devtools` unplugin을 함께 사용한다 (`/ait:inject-devtools` 참고).

### 4. consumer backend 구현 — bridge `POST /oidc/token` 교환

mini-app은 authorizationCode를 **자신의 백엔드**로 전달하고, 백엔드가 bridge를 호출한다.
bridge 요청/응답 JSON 계약, Supabase Edge Function 코드 예, Edge Function 배포(`supabase functions deploy`
+ `supabase secrets set`), 클라이언트 `signInWithIdToken`/Firebase `signInWithCredential` 코드 전체는
**Read <이 skill의 base directory>/references/backend-integration.md**.

핵심만 요약하면: 백엔드가 `POST /oidc/token`(self-host 루트 마운트)으로
`{grant_type, code, client_id, referrer, client_secret?}`를 보내고, bridge가 돌려준 `id_token`만
클라이언트에 반환한다. 클라이언트는 그 `id_token`으로 Supabase `signInWithIdToken` 또는 Firebase
`signInWithCredential`을 호출한다(`signInWithPopup`은 타입이 맞지 않아 쓰지 않는다).

`referrer` 값은 `"DEFAULT"`(production)와 `"SANDBOX"`(앱인토스 샌드박스 — 브리지가 토스에 그대로
전달하는 필드라 mock authorizationCode의 실패를 막지 않는다. §6 참고) 둘뿐이다.

### 6. 검증 안내

**개발 중 (devtools sandbox) — 제한 사항 먼저 읽기**:

devtools mock은 `appLogin()`을 intercept해 `mock-auth-<uuid>` 형태의 가짜 authorizationCode를 반환한다. 이 가짜 코드는 클라이언트 레이어만 대체하며, 토스 서버에서 발급된 실제 코드가 아니다.

- **실 토스 mTLS API를 물고 있는 브리지와 조합하면 동작하지 않는다.** 브리지는 가짜 코드를 토스 mTLS API로 그대로 전달하므로 업스트림에서 실패한다. `upstream_error`가 반환되면 설정 오류가 아니라 **이 구조적 한계 때문이다**.
- `referrer: "SANDBOX"` 는 mock 전환 스위치가 아니다 — 브리지가 그대로 토스에 전달하는 필드이므로 가짜 코드의 실패를 막지 못한다.
- **가짜 코드로 end-to-end `/oidc/token` → `id_token` 경로를 테스트하려면 self-host 브리지에서 `BRIDGE_TOSS_ADAPTER=mock` 환경변수를 설정**해야 한다(self-host 전용 옵션, 합성 id_token 반환).

개발 중 현실적인 검증 범위:
1. `pnpm dev` — mock이 `appLogin()` intercept → 가짜 authorizationCode 반환까지 확인
2. 백엔드가 코드를 수신해 브리지 호출 직전까지 로그로 확인 (id_token 디코딩은 아래 네이티브 검증에서)
3. self-host 브리지(`BRIDGE_TOSS_ADAPTER=mock`)가 있으면 합성 id_token까지 검증 가능

**앱인토스 네이티브 검증**:
1. `/ait:deploy` 실행 (번들러 `ait` CLI로 업로드 — `/ait:deploy` 참고)
2. 토스 앱에서 미니앱 열기 → `appLogin()` 실행 → 백엔드가 `referrer: "DEFAULT"`로 교환
3. `id_token`의 `sub` claim이 실제 토스 계정 ID인지 확인

sdk-example의 Auth 페이지(`AuthPage → OidcBridgeSection`)에서 bridge token 교환 흐름을 인터랙티브하게 테스트해볼 수 있다.

### 7. 완료 요약 + 다음 단계

배선 완료 후 한 블록으로 마무리한다:

```
auth-setup 완료

배선된 것:
  - appLogin() → consumer backend → bridge token 교환 → signInWithIdToken
    self-host 루트 마운트: /oidc/token
  - bridge URL: <bridge-url> (self-host 인스턴스)
  - 백엔드 배포: supabase functions deploy toss-login 완료
  - 환경변수: OIDC_BRIDGE_BASE_URL, OIDC_BRIDGE_CLIENT_ID supabase secrets 등록

다음 단계:
  pnpm dev            # devtools sandbox에서 appLogin() mock으로 흐름 확인
  /ait:setup-bundle   # .ait 번들 빌드 환경 추가 (granite.config.ts — deploy 전제)
  /ait:register       # 앱인토스 콘솔에 앱 등록 (aitcc.yaml 생성 — deploy 전제)
  /ait:deploy         # 번들 업로드 → native end-to-end 검증
  /ait:status         # 배포 후 콘솔 상태 확인
```

native 검증은 번들·등록이 선행되어야 하므로, sandbox 확인이 끝나면 `/ait:setup-bundle`
→ `/ait:register` → `/ait:deploy` 순으로 station 5를 진행한다(`/ait:deploy`는
`granite.config.ts`와 `aitcc.yaml`이 없으면 hard-stop한다).

## 하지 말아야 할 것

- `authorizationCode`를 로그·URL·localStorage에 그대로 저장하지 말 것 — 단기 일회용 코드다.
- mini-app(클라이언트)에서 bridge를 **직접** 호출하도록 안내하지 말 것 — 항상 consumer backend를 경유한다.
- `/verify` 엔드포인트를 사용하도록 안내하지 말 것 — 해당 엔드포인트는 제거됨(HTTP 404).
- `/firebase-token`을 호출하도록 안내하지 말 것 — 미구현이라 404다.
- 종료된 `oidc-bridge.aitc.dev`를 bridge URL 기본값으로 채우지 말 것 — self-host 주소를 사용자에게 받는다.
- `appLogin()` 없이 authorizationCode를 하드코딩하는 예제 금지.
- "공식 토스 로그인", "토스가 제공하는 auth" 등 제휴 암시 표현 금지.

## 참고

- 상세가 필요하면 Read <이 skill의 base directory>/references/backend-integration.md (bridge 요청/응답 계약, Supabase Edge Function 코드, 배포 명령, 클라이언트 signInWithIdToken/Firebase 코드 전체).
- 커뮤니티 docs — 토스 로그인 흐름: https://github.com/apps-in-toss-community/docs/blob/main/docs/guides/auth-flow.mdx
- 커뮤니티 docs — oidc-bridge 통합(consumer backend·operator mTLS·mock adapter): https://github.com/apps-in-toss-community/docs/blob/main/docs/guides/oidc-bridge.mdx
- oidc-bridge repo: https://github.com/apps-in-toss-community/oidc-bridge
- 커뮤니티가 운영하던 공용 인스턴스(`oidc-bridge.aitc.dev`)는 `aitc.dev` 도메인 정리와 함께 종료된다 — self-host 경로만 남는다.
- sdk-example 레퍼런스 구현: `supabase/functions/toss-login/index.ts` + `src/snippets/auth/oidcExchange.ts`
- sdk-example AuthPage (실제 dog-food 패턴): https://github.com/apps-in-toss-community/sdk-example/blob/main/src/pages/AuthPage.tsx
- 짝 skill: `inject-devtools` (sandbox 환경에서 `appLogin()` mock 제공)
- 짝 skill: `deploy` (앱인토스에 배포해 native 검증)
