# 슈트 B — e2e 완주·비용·분산 측정

"작은 아이디어 → 작동하는 미니앱"을 **에이전트가 자율로 얼마나·얼마의 비용으로 완주하는가**를
정량 측정하는 harness다. `/ait new` → (`/ait setup-bundle`) → 번들 빌드(`.ait` 생성)까지의
멀티턴 완주를 [Claude Agent SDK](https://www.npmjs.com/package/@anthropic-ai/claude-agent-sdk)
직접 드라이버로 격리 실행하고, **모델 tier별로 (완주율 · 성공당 토큰 · run-to-run 분산)** 을
수집한다.

슈트 A(`../promptfoo/`)는 skill **라우팅 정합성**(맞는 발화→맞는 skill, single-turn)을 본다.
슈트 B는 그게 못 보는 **멀티턴 완주·비용·분산**을 본다. 둘은 형제이고 A는 이 작업으로 안 바뀐다.

> **CI gate 아니다.** 메인테이너가 clean 세션에서 **수동·트리거 기반**으로 돌리는 오프라인
> harness다 — 조직 차원 telemetry 전면 제거 원칙(런타임 자동수집 금지)을 따른다. API 키·비용·
> 모델 변동 때문에 PR gate 로 두지 않는다. skill/템플릿을 크게 고친 뒤 회귀·비용 변화를 본다.

---

## 무엇을 재나 (KPI 3종)

| KPI | 정의 | 산식 |
|---|---|---|
| **완주율** | N회 중 `.ait` 번들까지 도달한 비율 | `successes / N` + Wilson 95% CI (작은 N의 binary는 CI가 넓다 — 정직하게) |
| **성공당 토큰** | 성공 run 만의 총 토큰 중앙값 + IQR | `median(tokens \| success)` + p25/p75 |
| **run-to-run 분산** | 같은 시드·tier 반복 간 흔들림 | 토큰 CV(σ/μ) + 완주율 CI 폭 + station 도달 분포 |

**왜 분산이 KPI인가**: TS Agent SDK `Options`에 `temperature`/`top_p`가 노출되지 않는다 —
sampling 파라미터는 우리가 돌릴 lever가 아니다. 우리가 고정할 수 있는 입력은 **시드 프롬프트
문자열 · 템플릿 SHA · SDK 버전 · `pricing.json` · effort 레벨**뿐이고, 그걸 다 고정해도 남는
흔들림이 모델 본질의 가변성이다. 사용자 원문("Opus·Sonnet·Haiku는 성능이 가변적이잖아")의
직접 대응 — 그 가변성 자체를 CV로 정량화한다.

### 1차 신호는 토큰 (USD 아님)

Agent SDK의 `total_cost_usd`/`costUSD`는 **클라이언트-사이드 추정치**다(공식 cost-tracking
가이드: *"client-side estimates, not authoritative billing data … Do not bill end users or
trigger financial decisions"*). SDK가 빌드 시점 가격표로 로컬 계산하므로 가격/모델 변경 시
drift 한다.

- **1차 저장값 = 토큰** — `runs.jsonl`에 `modelUsage[model].{inputTokens, outputTokens,
  cacheReadInputTokens, cacheCreationInputTokens}`. 토큰은 결정적이고 가격표 비의존.
- **USD는 파생값** — `pricing.json`으로 리포트 시점에 토큰에서 재계산. 가격이 바뀌면
  `pricing.json`만 고치고 과거 토큰을 다시 돌려 일관 비교. `total_cost_usd`는 참고로만 같이
  기록하고 KPI 산식엔 안 들어간다.

---

## 실행

```bash
# 키 주입(평문 커밋 금지) — .env.eval 에 ANTHROPIC_API_KEY=op://... 권장
op run --env-file=.env.eval -- pnpm eval:e2e --task timer --model claude-haiku-4-5 --n 5
```

인자:

| 인자 | 기본값 | 뜻 |
|---|---|---|
| `--task <id>` | (필수) | `tasks/<id>.task.json` |
| `--model <id>` | `claude-haiku-4-5` | 모델 alias 또는 full id (비용 floor가 기본) |
| `--n <int>` | 3 | 반복 횟수 |
| `--max-turns <int>` | 60 | 안전 상한 |
| `--keep` | off | 실패 디버깅용 격리 디렉토리 보존 |
| `--log-init` | off | 첫 run의 init `slash_commands`/`skills` 키를 stderr로 출력 |

첫 실행에는 `--log-init`을 붙여 init 메시지의 실제 slash-command 키 표현(`"ait new"` vs `"ait"`
vs 파일명)을 확인하는 것을 권한다 — 드라이버의 init assert는 그 표현이 미확정이라 "ait 계열
명령이 1개 이상 존재"로 느슨하게 시작한다.

---

## 결과 읽는 법

stdout 요약 예:

```
── timer × claude-haiku-4-5  (n=5)
   완주율        80%  [95% CI 38%–96%]  (4/5)
   성공당 토큰   median 312,440  [IQR 287,100–355,800]
   토큰 CV       0.142  (run-to-run 분산)
   USD/완주      $0.4210  (pricing.json 재계산, 참고)
   도달 분포     bundle:4 install:1
   실패 분류     build:1
```

- **완주율 CI가 넓으면** N이 작다는 신호 — `--n`을 키운다.
- **토큰 CV가 크면** 그 tier가 같은 작업을 들쭉날쭉 푼다는 뜻(가변성). tier 비교의 핵심 축.
- **도달 분포 / 실패 분류**로 *어디서* 막히는지 본다(scaffold/install/build/timeout/
  dispatch-missing 등). `dispatch-missing`은 `/ait`가 세션에 안 떴다는 뜻 → symlink/플러그인
  로드 점검.

| 파일 | git | 내용 |
|---|---|---|
| `results/runs.jsonl` | **gitignore** | run당 1줄, 토큰 raw가 여기. 메인테이너 로컬 산출물. |
| `baseline.json` | committed | 의미 있는 측정 후 갱신하는 시계열 기준선(날짜·SDK·템플릿SHA + tier별 KPI). |
| `pricing.json` | committed | tier별 per-MTok 단가. 토큰→USD 재계산 입력. |

---

## 안전 불변 (반드시 지킨다)

- **build-only가 기본 — 콘솔 무접촉.** 드라이버는 콘솔 API를 아예 안 부른다. dog-food 앱
  `31146`은 구조적으로 못 건드린다.
- **`register`/`deploy`/`auth-setup` 슬래시 명령 디스패치 금지.** 특히 `register`는 매 run
  서버 발급 새 `miniAppId`를 자동 기록한다(= "lock 풀려고 새 앱 만들기" 반-패턴). 드라이버
  프롬프트에 금지 명시 + `disallowedTools` 게이트로 2중 차단.
- **시크릿 값(Deploy Key·TOTP 등)은 stdout/stderr/`runs.jsonl`/로그 어디에도 출력 금지.**
- 콘솔 변이가 끼는 deploy 격리 경로(측정 전용 앱/프로파일, `--profile`만, 워크스페이스/앱
  throw 게이트)는 **P2 opt-in**이고 P1에는 없다.

---

## Phase

- **P1 (현재)** — build-only · 토큰/비용 · 작은 N. 콘솔/Docker/폰 전부 미포함.
- **P2** — Docker sandbox + deploy-isolated opt-in(측정 전용 앱·`--profile`·throw 게이트).
- **P3** — 멀티모델 매트릭스(opus/sonnet/haiku × 시드 × N) + provider-agnostic 어댑터
  (OpenRouter/Codex/Qwen) + (선택) effort 축. 이 단계에서 Inspect AI 재평가.

---

커뮤니티 오픈소스 프로젝트입니다.
