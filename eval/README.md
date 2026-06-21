# ait 플러그인 harness eval 슈트

`ait` 플러그인(앱인토스 미니앱 harness)이 **에이전트 안에서 실제로 동작하는가**를
손으로 돌리는 마크다운 체크리스트보다 엄격하게 검증하는 eval 슈트다.

| 프레임워크 | 무엇을 보나 | 채점 방식 | 모델 |
|---|---|---|---|
| **promptfoo** | skill 트리거링 **정합성** — 맞는 발화에서 맞는 skill 이 뜨고(positive), off-topic 발화에서 안 뜨는가(negative control) | **deterministic** — `skill-used` / `not-skill-used` metadata assertion (LLM-judge 아님) | `claude-sonnet-4-5` |

> **이 슈트는 CI 에 묶여 있지 않다.** 메인테이너가 clean 세션에서 로컬로 수동 실행한다.
> API 키·모델 호출 비용·약한 모델 run-to-run 변동 때문에 PR gate 로 두지 않는다. 회귀가
> 의심되거나 skill 문서를 크게 고친 뒤 직접 돌려 본다.

---

## 디렉토리

```
eval/
├── README.md                      # 이 문서
└── promptfoo/
    ├── promptfooconfig.yaml        # positive + negative-control skill 트리거링 테스트
    ├── setup-fixture.sh            # shared/skills -> fixture/.claude/skills symlink (매 실행 선행)
    └── fixture/
        └── .gitignore              # 생성되는 symlink·런타임 파일 무시
```

---

## 설치

promptfoo 는 이 repo 의존성이 **아니다**(eval 전용 도구). 돌릴 때만 npx 로 즉석 실행한다.

```bash
npx promptfoo@latest --version
```

공통 전제:

```bash
# op-env 로 주입 (평문 커밋 금지)
# .env.eval 에 ANTHROPIC_API_KEY=op://vault/item/field 형태로 관리 권장
export ANTHROPIC_API_KEY=...
```

---

## 1. promptfoo — skill 트리거링 정합성

각 skill 에 대해 최소 1개 positive 한국어 발화(`skill-used` assertion)와, 잘못 트리거되기
쉬운 skill 을 못박는 negative-control 발화(`not-skill-used`)를 둔다. assertion 은 한 턴
동안 어떤 skill 이 로드됐는지의 **metadata 만** 본다 — 모델 산문을 채점하지 않으므로
재현 가능하고 flaky 하지 않다.

### 실행

```bash
# 1) fixture 셋업 — shared/skills 를 .claude/skills 로 노출 (매번 선행 필수)
bash eval/promptfoo/setup-fixture.sh

# 2) 실행 (pnpm 스크립트로 한 번에)
pnpm eval:promptfoo

# op-env 로 API 키 주입하는 경우
op run --env-file=.env.eval -- pnpm eval:promptfoo

# 3) 결과 보기
npx promptfoo@latest view
```

**fixture 가 왜 필요한가**: promptfoo 의 `claude-agent-sdk` provider 는
`setting_sources: ['project']` 로 `working_dir` 안의 `.claude/skills/` 에서 skill 을
발견한다. 우리 skill 의 source of truth 는 `shared/skills/` 이므로, 복사하면 즉시 drift
한다. `setup-fixture.sh` 가 매 실행마다 `fixture/.claude/skills` 를 `shared/skills` 로
향하는 **symlink** 로 재생성해 항상 최신 skill 을 가리킨다(그래서 symlink 는 gitignore).

**결과 읽기**: 각 행이 한 발화. positive 행은 기대 skill 이 로드되면 PASS, negative 행은
지정한 skill 들이 **모두** 로드되지 않으면 PASS. 실패하면 발화 문구나 skill `description`
(트리거 신호)을 손본다 — skill 절차가 아니라 **라우팅**의 문제다.

### 첫 실행 결과

<!-- 첫 실행 후 메인테이너가 아래를 채운다 (API 비용 때문에 자동 실행하지 않음). -->
<!-- 기록 항목: 날짜 · promptfoo 버전 · positive pass 수 / 전체 · negative pass 수 / 전체 -->

| 항목 | 값 |
|---|---|
| 실행 날짜 | *(첫 실행 후 기록)* |
| promptfoo 버전 | *(첫 실행 후 기록)* |
| positive pass | *(첫 실행 후 기록)* |
| negative pass | *(첫 실행 후 기록)* |

---

## 2. 수동 clean-session smoke 체크리스트 (stations 0→5 happy path)

자동 eval 과 별개로, skill 을 크게 고친 뒤에는 **새 Claude Code 세션**에서 아래 happy
path 를 손으로 한 번 훑는다. 자동 eval 이 못 잡는 것 — skill 끼리의 **seam**(다음 station
명령을 직접 인쇄하는가)과 출력 톤 — 을 사람이 확인하는 단계다. 각 station 에서 두 가지를
본다: ① 기대 산출물이 나왔는가, ② 출력 마지막 블록이 **다음 station 명령을 직접 인쇄**하는가.

| # | station | 명령 | 기대 산출물 | seam (다음 명령을 인쇄?) |
|---|---|---|---|---|
| 0 | install | `/plugin marketplace add apps-in-toss-community/agent-plugin` → `/plugin install` | `/ait *` 명령이 존재 | (플러그인 메커니즘) → `/ait new` 안내 |
| 1 | scaffold | `/ait new demo-shop` | `./demo-shop/` + package.json + index.html | ✅ `pnpm dev` → `/ait setup-bundle` → `/ait register` → `/ait deploy` 인쇄 |
| 2 | dev | `cd demo-shop && pnpm dev` | 브라우저에서 devtools panel 과 함께 실행 | ✅ 회귀 의심 시 `/ait debug` 로 분기 |
| 3 | debug | `/ait debug` | 환경 4겹 분기 안내(환경 1 브라우저 / 2 PWA / 3·4 MCP attach) | ✅ 환경에 맞는 다음 동작(`setup-phone-preview` 등) |
| 4 | auth | `/ait auth-setup` | oidc-bridge 연결 옵션 배선 | ✅ 다음 단계(번들/배포) |
| 5 | bundle | `/ait setup-bundle` | granite.config.ts + scripts.bundle:ait + cli devDep | ✅ `/ait register` → `/ait deploy-key` → `/ait deploy` 인쇄 |
| 5 | register | `/ait register` | aitcc.yaml 생성 → `aitcc app register` | ✅ `/ait deploy` (또는 `/ait deploy-key` 선행) |
| 5 | deploy | `/ait deploy` | `ait build` → `.ait` 업로드 → scheme URL 표시 | ✅ `/ait status` / `/ait logs` 로 운영 분기 |

확인 포인트(seam 규칙 — umbrella `CLAUDE.md` §1.3.3):

- **각 skill 의 마지막 블록**이 다음 실행할 `/ait` 명령(또는 `pnpm dev`)을 **직접 인쇄**하는가.
  "사용자가 알아서 안다"고 가정하면 seam 이 끊긴 것.
- read-only skill(`status`/`logs`)은 **관측 결과에 따라 분기하는** seam 인가
  (예: 등록 안 됨 → `/ait register`).
- 출력 톤: 차분한 한 블록 마무리. 과한 이모지·방어적 disclaimer·헤더 직후 `>` blockquote 금지.
- "공식(official)" / "powered by Toss" / 제휴 암시 표현이 산출물 어디에도 없는가(커뮤니티 OSS).

---

## 참고

- Inspect AI 기반 harness 완주 robustness probe(약한 모델의 station 실행 검증)는
  Docker sandbox + 실행 계획이 확보된 시점에 별도 이슈로 재도입 예정.

---

커뮤니티 오픈소스 프로젝트입니다.
