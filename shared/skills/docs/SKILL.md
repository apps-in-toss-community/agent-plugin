---
name: docs
description: |
  Fetch a curated Apps in Toss SDK docs page by topic. User invokes
  `/ait docs <topic>` (e.g. `/ait docs clipboard`, `/ait docs auth/login`).
  The skill resolves the topic to a path in the community `docs` repo
  (https://github.com/apps-in-toss-community/docs — Docusaurus 3 site) and
  loads the content into the session via `Read` (if the repo is cloned
  locally) or `WebFetch` (otherwise). Use this when the user asks
  "앱인토스 docs에서 X 찾아줘", "how do I use X API?", or invokes
  `/ait docs`. 토픽이 생략되면 사용자에게 되묻는다.
argument-hint: '[topic]'
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

## 대상 문서 구조 (Docusaurus 3)

docs repo는 Docusaurus 3 기반. 콘텐츠 루트는 **`docs/docs/`** (repo 이름과
동일한 이름의 하위 디렉토리 — Docusaurus 관례):

```
docs/                              # repo root
└── docs/                          # Docusaurus content root
    ├── intro.md
    ├── getting-started/
    │   ├── what-is-apps-in-toss.md
    │   ├── quickstart.md
    │   └── ...
    ├── guides/                    # "왜/언제" 중심
    │   ├── auth-flow.md
    │   ├── iap-workflow.md
    │   └── ...
    ├── api/                       # "무엇/어떻게" 레퍼런스
    │   └── <group>/
    │       └── <method>.mdx       # 예: api/clipboard/setClipboardText.mdx
    ├── recipes/
    └── reference/
        ├── changelog.md
        ├── community-projects.md
        └── glossary.md
```

파일 확장자는 `.md` 또는 `.mdx` 혼용(특히 `api/`는 `.mdx`가 흔하다). 리졸버는
둘 다 시도한다.

## 토픽 → 경로 리졸빙

**입력 정규화**:
- kebab-case로 변환 (`getting started` → `getting-started`)
- 대소문자 무시
- 사용자가 슬래시 경로(`api/clipboard/setClipboardText`, `guides/auth-flow`)를
  주면 그대로 사용. 이 경우 섹션 prefix 추측은 건너뛴다.

**리졸빙 순서** (사용자가 `/ait docs <topic>`으로 호출, 슬래시 없는 단일 토픽):

1. `docs/api/<topic>/` — 디렉토리면 그 안의 `.md`/`.mdx` 파일 목록 제공, 사용자에게 정확한 method 선택을 되묻거나 index 파일(`index.md`/`index.mdx`)이 있으면 그것을 로드
2. `docs/api/<topic>.md` / `.mdx` — 단일 파일인 경우
3. `docs/guides/<topic>.md` / `.mdx`
4. `docs/getting-started/<topic>.md` / `.mdx`
5. `docs/recipes/<topic>.md` / `.mdx`
6. `docs/reference/<topic>.md` / `.mdx`
7. 위 모두 실패 → "토픽 찾지 못함" 처리 (아래 "Graceful fallback" 참고)

## 실행 순서

### 1. Docs repo 위치 확인

같은 부모 디렉토리에 `docs/` 체크아웃이 있으면 **로컬 우선** (빠르고 offline
작동). 로컬 root는 `../docs/`, 콘텐츠 루트는 **`../docs/docs/`**:

```bash
ls ../docs/docs 2>/dev/null
```

있으면 `Read ../docs/docs/<resolved-path>`로 로드.

없으면 원격 `WebFetch`. Raw URL 템플릿:

```
https://raw.githubusercontent.com/apps-in-toss-community/docs/main/docs/<resolved-path>
```

### 2. 토픽 후보 경로 시도

위 "리졸빙 순서"대로 차례로 시도. 첫 hit에서 중단.

예: `/ait docs clipboard`
- `ls ../docs/docs/api/clipboard/` → 디렉토리 있음, 안의 파일 나열
  (예: `setClipboardText.mdx`) → index가 없으면 사용자에게 "어떤 method를
  보여드릴까요?"로 되묻거나, 파일이 하나뿐이면 그대로 로드
- 로컬 없으면 `WebFetch https://api.github.com/repos/apps-in-toss-community/docs/contents/docs/api/clipboard`
  로 디렉토리 목록을 얻고 동일 처리

예: `/ait docs api/clipboard/setClipboardText`
- `Read ../docs/docs/api/clipboard/setClipboardText.mdx` → 로드
- 로컬 실패 시 `Read ../docs/docs/api/clipboard/setClipboardText.md`로 확장자 변경 재시도
- 여전히 실패 시 원격 WebFetch (`.mdx` → `.md` 순)

예: `/ait docs auth-flow`
- `api/auth-flow/` 없음 → `api/auth-flow.mdx` 없음 → `guides/auth-flow.md` 발견 → 로드

### 3. 로드한 내용을 사용자 컨텍스트로 요약

전문 덤프 대신 **사용자 원래 질문**(있으면)에 맞춰 관련 섹션 중심으로 요약.
코드 예제는 원문 그대로 인용. 문서 원본 링크를 마지막에 남긴다:

```
출처: https://github.com/apps-in-toss-community/docs/blob/main/docs/<resolved-path>
```

### 4. 후속 액션 유도 (선택)

docs 페이지는 각 API에 대해 **"Try it"** 섹션으로 sdk-example의 대응 카드에
deep-link한다. 관련 카드가 있으면 링크로 제안:

> 실제 동작을 보고 싶다면 sdk-example의 해당 카드에서 바로 실행해볼 수
> 있습니다: https://apps-in-toss-community.github.io/sdk-example/

## Graceful fallback (토픽 못 찾았을 때)

**중요**: docs repo가 아직 비어 있거나 해당 토픽 페이지가 없을 수 있다.
이건 에러가 아니라 **정상 상태** — 친절하게 안내한다.

```
"<topic>"에 대응하는 페이지를 docs repo에서 찾지 못했습니다.

가능한 원인:
- docs가 아직 해당 주제를 다루지 않음 (docs repo는 현재 작성 중입니다)
- 토픽 이름이 다를 수 있음 — 다음 경로에서 직접 탐색해보세요:
  https://github.com/apps-in-toss-community/docs/tree/main/docs

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
- ❌ `<topic>` 없이 호출됐을 때 전체 문서를 덤프 — 사용자에게 어떤 주제인지
  먼저 되묻는다 (예: "어떤 API를 찾으시나요? 예: clipboard, auth-flow, iap-workflow")
- ❌ 토스 공식 문서로 오해할 수 있는 표현 사용 ("공식 문서에 따르면..." 금지).
  대신 "커뮤니티 docs에 따르면..." 또는 "apps-in-toss-community/docs에서".

## 참고

- docs repo (Docusaurus 3): https://github.com/apps-in-toss-community/docs
- sdk-example (문서와 양방향 deep-link 관계): https://github.com/apps-in-toss-community/sdk-example
- 문서 IA와 API 페이지 템플릿은 `docs/CLAUDE.md`의 "정보 아키텍처 (IA)" 섹션
- 짝 repo 관계는 umbrella `../CLAUDE.md`의 "의존성 지도" 참고
