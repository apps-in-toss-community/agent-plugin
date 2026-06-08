# ait 플러그인 harness eval 슈트

`ait` 플러그인(앱인토스 미니앱 harness)이 **에이전트 안에서 실제로 동작하는가**를
손으로 돌리는 마크다운 체크리스트보다 엄격하게 검증하는 eval 슈트다. 2개 프레임워크를
조합해, 각각이 잘하는 것만 맡긴다.

| 프레임워크 | 무엇을 보나 | 채점 방식 | 모델 |
|---|---|---|---|
| **promptfoo** | skill 트리거링 **정합성** — 맞는 발화에서 맞는 skill 이 뜨고(positive), off-topic 발화에서 안 뜨는가(negative control) | **deterministic** — `skill-used` / `not-skill-used` metadata assertion (LLM-judge 아님) | `claude-sonnet-4-5` |
| **Inspect AI** | harness 핵심 station **완주** — 약한 모델이 skill 만으로 실제 파일 산출물을 만들어내는가 | **deterministic** custom scorer — 파일 존재 / package.json 키 / tool 시퀀스 (LLM-judge 아님) | `claude-haiku-4-5` (robustness probe) |

두 축은 직교한다. promptfoo 는 "**올바른 skill 이 선택되는가**"(라우팅), Inspect AI 는 "**그
skill 이 끝까지 동작하는가**"(실행)를 본다. 라우팅이 맞아도 약한 모델에서 절차가 깨질 수
있고, 절차가 견고해도 발화를 잘못 라우팅하면 station 이 시작조차 안 된다 — 그래서 둘 다 필요.

> **이 슈트는 CI 에 묶여 있지 않다.** 메인테이너가 clean 세션에서 로컬로 수동 실행한다.
> API 키·모델 호출 비용·약한 모델 run-to-run 변동 때문에 PR gate 로 두지 않는다. 회귀가
>의심되거나 skill 문서를 크게 고친 뒤 직접 돌려 본다.

---

## 디렉토리

```
eval/
├── README.md                      # 이 문서
├── promptfoo/
│   ├── promptfooconfig.yaml        # positive + negative-control skill 트리거링 테스트
│   ├── setup-fixture.sh            # shared/skills -> fixture/.claude/skills symlink (매 실행 선행)
│   └── fixture/
│       └── .gitignore              # 생성되는 symlink·런타임 파일 무시
└── inspect/
    └── harness_completion.py       # scaffold·dev·bundle-build 완주 probe (epochs + pass^k)
```

---

## 설치

두 프레임워크 모두 이 repo 의존성이 **아니다**(eval 전용 도구). 돌릴 때만 설치한다.

```bash
# promptfoo — npx 로 즉석 실행(설치 불필요)
npx promptfoo@latest --version

# Inspect AI — Python 패키지
pip install inspect-ai
```

공통 전제:

```bash
export ANTHROPIC_API_KEY=...   # op-env 등으로 주입. 평문 커밋 금지.
```

Inspect AI 의 `bundle_build` / `scaffold` task 는 **sandbox=docker** 를 쓴다 — 로컬에
Docker 가 떠 있어야 한다(모델이 격리된 작업 디렉토리에서 skill 절차를 실행).

---

## 1. promptfoo — skill 트리거링 정합성

각 skill 에 대해 최소 1개 positive 한국어 발화(`skill-used` assertion)와, 잘못 트리거되기
쉬운 skill 을 못박는 negative-control 발화(`not-skill-used`)를 둔다. assertion 은 한 턴
동안 어떤 skill 이 로드됐는지의 **metadata 만** 본다 — 모델 산문을 채점하지 않으므로
재현 가능하고 flaky 하지 않다.

```bash
# 1) fixture 셋업 — shared/skills 를 .claude/skills 로 노출 (매번 선행)
bash eval/promptfoo/setup-fixture.sh

# 2) 실행
npx promptfoo@latest eval -c eval/promptfoo/promptfooconfig.yaml

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

---

## 2. Inspect AI — harness 완주 robustness probe

약한 모델(Haiku)에게 skill 절차만 주고 핵심 station 을 실제로 수행시킨다. scorer 는
산출물을 기계적으로 검사한다(파일 존재 / package.json 키 / tool 호출 시퀀스).
**약한 모델을 일부러 쓰는 이유**: skill 문서가 강한 모델의 암묵 추론에 기대고 있으면
Haiku 에서 깨진다. Haiku 가 완주하면 절차가 충분히 명시적이라는 robustness 신호다.

task 3개:

| task | station | scorer 가 보는 산출물 |
|---|---|---|
| `scaffold` | 1 (new-miniapp) | `<pkg>/package.json` + web-framework dep + `index.html` |
| `dev_ready` | 2 (dev 준비) | 파일 생성/편집 tool 이 실제로 호출됐는가 |
| `bundle_build` | 5 (setup-bundle) | `granite.config.ts` + `scripts.bundle:ait` + `@apps-in-toss/cli` devDep |

```bash
# 약한 모델 probe — epochs 로 반복하고 pass^k 계열 reducer 로 집계
inspect eval eval/inspect/harness_completion.py \
    --model anthropic/claude-haiku-4-5 \
    --epochs 5 --epochs-reducer pass_at_1

# 결과 뷰어
inspect view

# 강한 모델과 비교하려면 모델만 바꿔 재실행
inspect eval eval/inspect/harness_completion.py \
    --model anthropic/claude-sonnet-4-5 --epochs 5 --epochs-reducer pass_at_1
```

**왜 epochs + pass^k 인가**: 약한 모델은 run-to-run 변동이 커서 단일 실행은 noise 다.
같은 task 를 여러 epoch 돌리고 reducer 로 "N 에폭 중 몇 번 통과했나"를 집계해야 station
이 약한 모델에서 얼마나 **안정적인지** 판단할 수 있다. pass^k 집계를 promptfoo 가 아니라
Inspect AI 에 둔 건 의도적이다(아래 caveats 참고).

**결과 읽기**: epoch 별 PASS/FAIL 과 reducer 집계 점수를 본다. 어떤 station 의 점수가
낮으면 그 skill 의 SKILL.md "실행 순서"에 약한 모델이 놓치는 암묵 단계가 있다는 신호 —
절차를 더 명시적으로 푼다(라우팅이 아니라 **실행**의 문제).

---

## 3. 수동 clean-session smoke 체크리스트 (stations 0→5 happy path)

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

## VERIFY / 첫 실행 caveats

이 슈트는 **네트워크 없는 환경에서 작성**됐다 — 라이브 설치본으로 실행해 검증하지 못한
지점들이 있다. 첫 실행 시 아래를 확인한다.

- **promptfoo `not-skill-used` / `skill-used` assertion** 은 비교적 최근 추가돼 문서화가
  얕다. 결과 상세에서 skill metadata 가 실제로 채워지는지 한 번 확인하라. 안 채워지면
  provider 의 `@anthropic-ai/claude-agent-sdk` 가 **0.2.120 미만**일 가능성이 높다
  (`npx promptfoo@latest eval` 가 끌어오는 버전 확인).
- **promptfoo working_dir 키 이름**이 provider 버전에 따라 `working_dir` / `cwd` /
  `workingDir` 일 수 있다. skill 이 0개로 잡히면 이 키부터 확인(`setup-fixture.sh` 를
  먼저 안 돌려도 0개가 된다).
- **promptfoo 의 native pass^k 는 불안정**해서, pass^k 집계는 promptfoo 가 아니라
  **Inspect AI 의 `epochs` + reducer** 에 뒀다. promptfoo 쪽은 정합성(트리거링)만 본다.
- **Inspect AI 의 `--epochs-reducer` 값 이름**(`pass_at_1` / `pass_at_k` / `mean` 등)은
  설치본의 `inspect eval --help` 에서 확인. pass^k 계열 reducer 가 들어 있다.
- **Inspect AI 모델 prefix** — Anthropic 모델은 `anthropic/claude-haiku-4-5` 처럼
  `anthropic/` prefix 를 붙인다. 이 컨벤션은 Inspect 고유다.
- **harness_completion.py 의 `# VERIFY:` 주석들** — import 경로, `basic_agent` 시그니처,
  `Sample.files` 의미(로컬 경로 vs 내용), `sandbox().read_file`/`write_file` 시그니처,
  `Score.value` 관용, `@task` 의 epochs/Epochs 전달 방식, `state.messages` 의 tool-call
  속성명 — 모두 현재 API 지식 기준이라 설치본에서 한 번 확인이 필요하다. 파일 안 해당
  지점마다 `# VERIFY:` 로 표시해 뒀다.

---

커뮤니티 오픈소스 프로젝트입니다.
