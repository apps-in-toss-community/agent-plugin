---
name: logs
description: |
  Show runtime log options for the current mini-app. The Apps in Toss
  console does not expose a runtime log endpoint, so this skill explains
  the confirmed gap and guides the user to practical alternatives.
  Triggered by `/ait logs`.
argument-hint: ''
---

# logs skill

## 목적

`/ait logs`는 현재 미니앱의 런타임 로그 옵션을 안내한다.

상태는 **deferred**다: `aitcc logs` 명령은 구현되지 않았다. 앱인토스 콘솔 UI에
런타임 로그를 서피스하는 엔드포인트가 없음이 확인되었기 때문이다(2026-05-02 조사
결과). 이건 콘솔 설계 현황이지 플러그인 버그가 아니다.

따라서 이 skill은 `aitcc`를 호출하는 대신 **현재 가능한 대안 네 가지**를 안내한다.

## 실행 순서

### 1. 상황 명시

사용자에게 다음을 전달한다:

```
Apps in Toss 콘솔은 현재 런타임 로그 API를 공개하지 않습니다.
`aitcc logs` 명령은 이 이유로 구현이 보류되어 있습니다.

아래 대안 중 가장 적합한 방법을 선택해주세요.
```

### 2. 대안 안내

다음 네 가지를 구체적으로 안내한다. 사용자 컨텍스트에 따라 가장 관련성 높은
것을 먼저 제시한다 (cwd에 `aitcc.yaml`이 있으면 3번 먼저).

#### 대안 1: events catalog — `aitcc app events`

앱인토스 콘솔이 제공하는 이벤트 카탈로그를 조회한다.
런타임 로그는 아니지만 앱 등록·검토·상태 변경 등의 **이벤트 이력**을 확인할 수 있다.

```bash
aitcc app events ls --json        # 현재 디렉토리의 aitcc.yaml 기준
aitcc app events ls <appId>       # appId 직접 지정
```

`aitcc`가 PATH에 없으면 설치 안내 (`npm i -g @ait-co/console-cli`).

#### 대안 2: 앱 메트릭 — `aitcc app metrics`

배포된 미니앱의 **전환 지표**(노출·전환 등 날짜 범위별 집계)를
콘솔에서 조회한다. 런타임 성능·오류율·응답 시간은 이 명령의 범위 밖이다.

```bash
aitcc app metrics --json
# 날짜 범위·버킷 단위 지정
aitcc app metrics --time-unit DAY|WEEK|MONTH --start YYYY-MM-DD --end YYYY-MM-DD --json
```

기본 조회 범위는 오늘 기준 최근 30일(`--time-unit DAY`). `PREPARE` 상태(미출시)이면 `metrics` 배열이 비어 있는 것이 정상이다.

#### 대안 3: 브라우저 DevTools 콘솔 (로컬 개발)

로컬 개발 서버(`pnpm dev`)를 통해 미니앱을 실행하면 브라우저 DevTools 콘솔에서
런타임 로그를 확인할 수 있다.

**devtools MCP가 활성화되어 있으면** (`/ait debug` 참고):

```
/ait debug → 브라우저 상태·콘솔 오류 캡처
```

**devtools MCP가 없으면** 사용자에게 직접 확인을 안내한다:

```
브라우저 F12 → Console 탭 → 미니앱 런타임 오류/로그 확인
```

devtools 설정이 안 되어 있으면 `/ait inject-devtools`를 먼저 실행한다.

#### 대안 4: 프로덕션 텔레메트리 (직접 설정 필요)

앱인토스 미니앱에서 외부 로깅 서비스로 전송하는 방법이다.
콘솔 측 지원이 없으므로 **사용자가 직접 SDK를 앱에 통합**해야 한다.

권장 패턴:

- **Sentry** — `@sentry/browser` + `Sentry.init()`. 오류 캡처, 세션 리플레이.
- **LogRocket** — 세션 리플레이 + 콘솔 로그 캡처.
- **자체 백엔드 로그 수집** — `fetch`로 로그 엔드포인트로 전송.

```typescript
// 예: Sentry 최소 설정 (vite + react-vite 템플릿)
import * as Sentry from "@sentry/browser";

Sentry.init({
  dsn: "YOUR_SENTRY_DSN",
  integrations: [Sentry.replayIntegration()],
});
```

이 방법은 앱인토스 콘솔과 무관하게 작동하며, 프로덕션 배포 후에도 로그를
수집할 수 있다.

### 3. 다음 단계 (관측 결과에 따라 분기)

대안 안내 후 관측 결과에 맞는 다음 단계를 코드블록으로 출력한다:

이벤트 이력을 바로 확인하고 싶으면:
```
aitcc app events ls --json
```

devtools가 설치되지 않아 브라우저 콘솔 관측이 안 된다면:
```
/ait inject-devtools
```

앱 콘솔 상태(serviceStatus, 검수 결과)를 함께 보려면:
```
/ait status
```

## 하지 말아야 할 것

- ❌ `aitcc logs`를 호출하거나 호출 시도. 명령이 없으므로 오류만 발생한다.
- ❌ 대안 없이 "불가능합니다"만 전달. 반드시 실행 가능한 대안을 제시한다.
- ❌ 엔드포인트 부재를 에러처럼 표현. 이것은 콘솔 설계 현황이지 플러그인 버그가 아니다.
- ❌ 사용자가 명시적으로 물어보지 않은 외부 서비스 설정을 자동 실행.

## 참고

- console-cli: https://github.com/apps-in-toss-community/console-cli
- 짝 skill: `status` (앱 리뷰 상태 + serviceStatus 확인)
- 짝 skill: `debug` (devtools MCP가 있을 때 브라우저 상태 분석)
- 배경: GitHub Project harness roadmap — `aitcc logs` deferred (2026-05-02, 콘솔 측 런타임 로그 endpoint 부재 확정)
