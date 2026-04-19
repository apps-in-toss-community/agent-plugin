---
name: docs
description: |
  Fetch a curated Apps in Toss SDK docs page by topic. User invokes
  `/ait docs <topic>` (e.g. `/ait docs camera`, `/ait docs auth`). The skill
  resolves the topic to a path in the community `docs` repo
  (https://github.com/apps-in-toss-community/docs) and loads the content into
  the session via `Read` (if the repo is cloned locally) or `WebFetch`
  (otherwise). Use this when the user asks "앱인토스 docs에서 X 찾아줘",
  "how do I use X API?", or invokes `/ait docs`.
argument-hint: <topic>
---

# docs skill

## 목적

앱인토스 SDK의 **커뮤니티 큐레이션 문서**(`apps-in-toss-community/docs` repo)
에서 주제(`<topic>`)에 해당하는 페이지를 찾아 세션에 로드한다.

이 skill은 **지식 전달자**지 문서 저장소가 아니다. 실제 콘텐츠는
[apps-in-toss-community/docs](https://github.com/apps-in-toss-community/docs)가
source of truth. 이 skill은 "어디를 어떻게 읽을지"만 안내한다.

> 이 프로젝트는 비공식 커뮤니티 프로젝트다. docs repo 역시 커뮤니티가
> 재구성한 비공식 가이드이며, 토스/앱인토스 팀과 제휴 관계가 아니다.

## 토픽 → 경로 리졸빙

docs repo의 관례적 구조 (컨벤션):

```
docs/
├── content/
│   ├── api/
│   │   ├── camera.md
│   │   ├── clipboard.md
│   │   ├── auth.md
│   │   └── ...
│   ├── guides/
│   │   ├── getting-started.md
│   │   ├── polyfill-mode.md
│   │   └── ...
│   └── reference/
│       └── ...
```

**리졸빙 순서** (사용자가 `/ait docs <topic>`으로 호출):

1. `content/api/<topic>.md` — SDK API 주제 (camera, clipboard, auth, ...)
2. `content/guides/<topic>.md` — 가이드 문서 (getting-started, deployment, ...)
3. `content/reference/<topic>.md` — 레퍼런스
4. 위 모두 실패 시 → "토픽 찾지 못함" 처리 (아래 "Graceful fallback" 참고)

추가 규칙:
- `<topic>`은 kebab-case로 정규화 (`getting started` → `getting-started`)
- 대소문자 무시
- 사용자가 full path(`guides/deployment`)를 주면 그대로 사용

## 실행 순서

### 1. Docs repo 위치 확인

같은 부모 디렉토리에 `docs/` 체크아웃이 있으면 **로컬 우선** (빠르고 offline
작동):

```bash
ls ../docs/content 2>/dev/null
```

있으면 `Read ../docs/content/<resolved-path>.md`로 로드.

없으면 원격 `WebFetch`:

```
https://raw.githubusercontent.com/apps-in-toss-community/docs/main/content/<resolved-path>.md
```

### 2. 토픽 후보 경로 시도

위 "리졸빙 순서"대로 차례로 시도. 첫 hit에서 중단.

예: `/ait docs camera`
- `Read ../docs/content/api/camera.md` → 성공 시 종료
- 실패 시 `Read ../docs/content/guides/camera.md`
- 실패 시 `WebFetch https://raw.githubusercontent.com/apps-in-toss-community/docs/main/content/api/camera.md`
- 실패 시 guides, reference 원격도 시도

### 3. 로드한 내용을 사용자 컨텍스트로 요약

전문 덤프 대신 **사용자 원래 질문**(있으면)에 맞춰 관련 섹션 중심으로 요약.
코드 예제는 원문 그대로 인용. 문서 원본 링크를 마지막에 남긴다:

```
출처: https://github.com/apps-in-toss-community/docs/blob/main/content/api/camera.md
```

### 4. 후속 액션 유도 (선택)

관련된 `sdk-example` 페이지가 있으면 링크로 제안. 예:

> 실제 동작을 보고 싶다면 sdk-example의 Camera API 카드에서 바로 실행해볼
> 수 있습니다: https://apps-in-toss-community.github.io/sdk-example/#/api/camera

## Graceful fallback (토픽 못 찾았을 때)

**중요**: docs repo가 아직 비어 있거나 해당 토픽 페이지가 없을 수 있다.
이건 에러가 아니라 **정상 상태** — 친절하게 안내한다.

```
"<topic>"에 대응하는 페이지를 docs repo에서 찾지 못했습니다.

가능한 원인:
- docs가 아직 해당 주제를 다루지 않음 (docs repo는 현재 작성 중입니다)
- 토픽 이름이 다를 수 있음 — 다음 경로를 직접 확인해보세요:
  https://github.com/apps-in-toss-community/docs/tree/main/content

대안으로:
- 앱인토스 공식 문서를 `WebFetch`로 조회해볼 수 있습니다
- sdk-example에서 실제 동작하는 예제를 보여드릴 수 있습니다:
  https://apps-in-toss-community.github.io/sdk-example/

문서 기여: https://github.com/apps-in-toss-community/docs/issues/new
```

추측으로 API 동작을 꾸며내지 **말 것**. 문서에 없으면 "모릅니다"를
명시적으로 말하고, sdk-example 또는 공식 문서로 넘긴다.

## 하지 말아야 할 것

- ❌ 문서 내용을 **지어내기**. 없으면 없다고 말한다.
- ❌ docs repo에 write/commit (이 skill은 read-only)
- ❌ `<topic>` 없이 호출됐을 때 전체 문서를 덤프 — 사용자에게 주제를 되물어라
- ❌ 토스 공식 문서로 오해할 수 있는 표현 사용 ("공식 문서에 따르면..." 금지).
  대신 "커뮤니티 docs에 따르면..." 또는 "apps-in-toss-community/docs에서".

## 참고

- docs repo: https://github.com/apps-in-toss-community/docs
- sdk-example (문서와 양방향 deep-link 관계): https://github.com/apps-in-toss-community/sdk-example
- 짝 repo 관계는 umbrella `../CLAUDE.md`의 "의존성 지도" 참고
