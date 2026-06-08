# ait 플러그인 — harness 완주 robustness probe (Inspect AI)
# ======================================================================
# 무엇을 검증하나:
#   약한 모델(Haiku)이 ait 플러그인 skill 만으로 harness 핵심 station 을
#   "끝까지" 수행하는가 — scaffold(station 1) → dev 준비(station 2) →
#   번들 빌드 환경(station 5 setup-bundle). promptfoo 쪽이 "맞는 skill 이
#   트리거되는가"(정합성)를 본다면, 여기서는 "그 skill 이 실제로 동작하는
#   파일 산출물을 만들어내는가"(완주)를 본다.
#
#   약한 모델을 일부러 쓰는 이유: skill 문서가 강한 모델에만 의존하는
#   암묵 추론에 기대고 있으면, Haiku 에서 station 이 깨진다. Haiku 가
#   완주하면 skill 의 절차가 충분히 명시적이라는 robustness 신호다.
#
# 어떻게 채점하나 (deterministic — LLM-judge 아님):
#   각 scorer 는 산출물을 기계적으로 검사한다.
#     - 파일/디렉토리 존재 (scaffold 결과물, granite.config.ts)
#     - package.json 안의 키 존재 (scripts.bundle:ait, dependency)
#     - tool 호출 시퀀스 (Write/Edit 가 실제로 일어났는가)
#   모델 산문을 채점하지 않으므로 재현 가능하다.
#
# 약한 모델 probe + pass^k:
#   epochs 로 같은 task 를 여러 번 돌리고 pass_k reducer 로 집계한다.
#   "k 번 중 한 번이라도 통과"가 아니라 "신뢰도" 관점 — 약한 모델은
#   run-to-run 변동이 크므로 단일 실행은 noise 다. pass_k 로 "N 에폭 중
#   몇 번 통과했나"를 보고, station 이 약한 모델에서 얼마나 안정적인지
#   판단한다.
#
# 실행:
#   pip install inspect-ai
#   export ANTHROPIC_API_KEY=...
#   # 핵심 명령 — epochs 와 pass_k reducer 를 함께 건다:
#   inspect eval eval/inspect/harness_completion.py \
#       --model anthropic/claude-haiku-4-5 \
#       --epochs 5 --epochs-reducer pass_at_1
#   # 결과 뷰어:
#   inspect view
#
#   참고: --model 을 CLI 로 주면 아래 task 의 model 인자를 덮어쓴다.
#   파일에 박아둔 anthropic/claude-haiku-4-5 가 기본값(약한 모델 probe)이고,
#   강한 모델과 비교하려면 --model anthropic/claude-sonnet-4-5 로 재실행.
#
# VERIFY (첫 실행 시 — 라이브 inspect-ai 설치로 검증하지 못함):
#   - 이 파일은 네트워크 없는 worktree 에서 작성됐다. 아래 import 경로·
#     데코레이터·시그니처는 현재 Inspect AI API 지식 기준이고, 실제
#     설치본에서 한 번 확인이 필요하다. 불확실한 지점마다 `# VERIFY:` 표시.
#   - Inspect AI 의 Anthropic 모델 식별자는 `anthropic/` prefix 를 쓴다
#     (`anthropic/claude-haiku-4-5`). 이 prefix 컨벤션은 Inspect 고유라
#     provider 별로 다르다 — `inspect eval --help` 또는 `inspect list models`
#     로 확인.
#   - `--epochs-reducer` 의 정확한 값 이름(`pass_at_1` vs `pass_at_k` vs
#     `mean`)은 설치본의 `inspect eval --help` 에서 확인하라. pass^k 계열
#     reducer 가 들어있다(아래 주석 참고). promptfoo 의 native pass^k 는
#     불안정해서 pass^k 집계는 여기 Inspect 쪽에 둔다.
#   - 약한 모델 robustness probe 이므로 epochs 는 5 이상 권장
#     (단일 실행은 noise — 약한 모델은 run-to-run 변동이 크다).

from __future__ import annotations

import json
from pathlib import Path

# VERIFY: import 경로 — 현재 Inspect AI 패키지 레이아웃 기준. 설치본에서
# `from inspect_ai import ...` 가 실패하면 패키지명/하위모듈을 재확인.
from inspect_ai import Task, task
from inspect_ai.dataset import Sample
from inspect_ai.scorer import Score, Target, accuracy, scorer, stderr
from inspect_ai.solver import TaskState, basic_agent, solver, system_message
from inspect_ai.tool import bash, text_editor
from inspect_ai.util import sandbox

# ----------------------------------------------------------------------
# 경로 상수 — 이 파일 기준으로 repo 루트와 skills source 를 잡는다.
# ----------------------------------------------------------------------
_THIS = Path(__file__).resolve()
REPO_ROOT = _THIS.parents[2]  # eval/inspect/harness_completion.py -> repo root
SKILLS_SRC = REPO_ROOT / "shared" / "skills"


# ----------------------------------------------------------------------
# sandbox 안에서 산출물을 읽는 헬퍼.
#   scorer 는 sandbox 파일시스템을 통해 모델이 만든 파일을 확인한다.
#   (모델은 sandbox 의 작업 디렉토리에서 skill 절차를 실행한다.)
# ----------------------------------------------------------------------
async def _read_sandbox_file(path: str) -> str | None:
    """sandbox 안 파일을 읽되 없으면 None. 채점은 존재 여부로 한다."""
    try:
        # VERIFY: sandbox().read_file 시그니처 — text 모드 반환이 str 인지
        # bytes 인지 설치본에서 확인. 없을 때 raise 하는 예외 타입도
        # (FileNotFoundError) 확인 필요.
        return await sandbox().read_file(path, text=True)
    except FileNotFoundError:
        return None
    except Exception:
        # 그 외 sandbox 오류도 "파일 없음"으로 보수적으로 처리.
        return None


# ======================================================================
# SCORERS — 전부 deterministic. 모델 산문을 채점하지 않는다.
# ======================================================================


@scorer(metrics=[accuracy(), stderr()])
def scaffold_scorer():
    """station 1: /ait new 가 빈 디렉토리에서 동작하는 프로젝트를 만들었나.

    검사:
      - <pkg>/package.json 존재
      - package.json 에 @apps-in-toss/web-framework dependency 존재
      - <pkg>/index.html 존재 (vite 진입점)
    target 은 기대 패키지 디렉토리명(slug).
    """

    async def score(state: TaskState, target: Target) -> Score:
        pkg = target.text.strip()
        checks: dict[str, bool] = {}

        pkg_json_raw = await _read_sandbox_file(f"{pkg}/package.json")
        checks["package.json 존재"] = pkg_json_raw is not None

        has_sdk_dep = False
        if pkg_json_raw is not None:
            try:
                data = json.loads(pkg_json_raw)
                deps = {
                    **data.get("dependencies", {}),
                    **data.get("devDependencies", {}),
                }
                has_sdk_dep = "@apps-in-toss/web-framework" in deps
            except json.JSONDecodeError:
                has_sdk_dep = False
        checks["web-framework dependency"] = has_sdk_dep

        index_html = await _read_sandbox_file(f"{pkg}/index.html")
        checks["index.html 존재"] = index_html is not None

        passed = all(checks.values())
        # VERIFY: Score 의 value 로 CORRECT/INCORRECT 상수를 쓰는 게 관용인지
        # bool/숫자를 쓰는지 설치본에서 확인. 여기서는 reducer·accuracy 가
        # 1.0/0.0 으로 집계하도록 1.0/0.0 을 직접 넣는다.
        return Score(
            value=1.0 if passed else 0.0,
            answer=pkg,
            explanation="; ".join(f"{k}={v}" for k, v in checks.items()),
        )

    return score


@scorer(metrics=[accuracy(), stderr()])
def setup_bundle_scorer():
    """station 5: /ait setup-bundle 가 번들 빌드 환경을 배선했나.

    검사 (skill 의 산출물 정의 그대로):
      - <pkg>/granite.config.ts 존재
      - granite.config.ts 가 defineConfig 를 import (형태 sanity)
      - package.json scripts.bundle:ait == "ait build"
      - devDependencies 에 @apps-in-toss/cli 존재
    """

    async def score(state: TaskState, target: Target) -> Score:
        pkg = target.text.strip()
        checks: dict[str, bool] = {}

        granite = await _read_sandbox_file(f"{pkg}/granite.config.ts")
        checks["granite.config.ts 존재"] = granite is not None
        checks["defineConfig import"] = (
            granite is not None and "defineConfig" in granite
        )

        pkg_json_raw = await _read_sandbox_file(f"{pkg}/package.json")
        bundle_script_ok = False
        cli_dep_ok = False
        if pkg_json_raw is not None:
            try:
                data = json.loads(pkg_json_raw)
                scripts = data.get("scripts", {})
                bundle_script_ok = scripts.get("bundle:ait") == "ait build"
                dev_deps = data.get("devDependencies", {})
                cli_dep_ok = "@apps-in-toss/cli" in dev_deps
            except json.JSONDecodeError:
                pass
        checks["scripts.bundle:ait"] = bundle_script_ok
        checks["@apps-in-toss/cli devDep"] = cli_dep_ok

        passed = all(checks.values())
        return Score(
            value=1.0 if passed else 0.0,
            answer=pkg,
            explanation="; ".join(f"{k}={v}" for k, v in checks.items()),
        )

    return score


@scorer(metrics=[accuracy(), stderr()])
def edited_files_scorer():
    """station 2(dev 준비)에 대한 tool-sequence 검사.

    scaffold 가 끝나면 dev 진입을 위해 모델이 실제로 파일을 만지는
    (Write/Edit/bash) 흔적이 있어야 한다. 산출물 파일이 없는 station 의
    경우, 모델이 "했다고 말만" 하지 않고 tool 을 호출했는지를 본다.

    검사: 대화 메시지 안에 파일 생성/편집 tool 호출이 1회 이상 존재.
    """

    async def score(state: TaskState, target: Target) -> Score:
        # VERIFY: state.messages 의 tool-call 표현 방식 — 설치본에서
        # ChatMessageAssistant.tool_calls 의 정확한 속성명을 확인.
        # 여기서는 메시지를 순회하며 tool_calls 의 function 이름을 모은다.
        tool_names: list[str] = []
        for msg in state.messages:
            calls = getattr(msg, "tool_calls", None)
            if not calls:
                continue
            for call in calls:
                fn = getattr(call, "function", None)
                if fn:
                    tool_names.append(fn)

        # bash / text_editor (파일 쓰기) 중 하나라도 호출됐는가.
        file_touch = any(
            name in ("bash", "text_editor") for name in tool_names
        )
        return Score(
            value=1.0 if file_touch else 0.0,
            answer=",".join(tool_names) or "(no tool calls)",
            explanation=f"tool 호출 {len(tool_names)}회; 파일 조작={file_touch}",
        )

    return score


# ======================================================================
# SANDBOX 셋업 solver — skills 를 sandbox 에 노출한다.
#   모델이 sandbox 안에서 .claude/skills/ 로 skill 을 발견하도록,
#   shared/skills 를 sandbox 의 작업 디렉토리에 심는다.
# ======================================================================
@solver
def stage_skills():
    """sandbox 작업 디렉토리에 .claude/skills/ 를 심는다.

    promptfoo fixture 와 같은 의도 — skill source of truth(shared/skills)를
    그대로 노출해 drift 를 막는다. sandbox 는 격리돼 있으므로 symlink 대신
    파일을 복사해 넣는다.
    """

    async def solve(state: TaskState, generate):
        # VERIFY: sandbox().write_file 로 디렉토리 트리를 통째로 넣는 표준
        # 방법이 설치본에 있는지 확인. 없으면 docker compose 의 volume mount
        # 또는 Sample.files 로 사전 주입하는 방식으로 바꾼다(아래 task 의
        # files= 참고). 여기서는 각 SKILL.md 를 개별 write 한다.
        for skill_dir in sorted(SKILLS_SRC.iterdir()):
            if not skill_dir.is_dir():
                continue
            skill_md = skill_dir / "SKILL.md"
            if skill_md.exists():
                dest = f".claude/skills/{skill_dir.name}/SKILL.md"
                await sandbox().write_file(dest, skill_md.read_text())
        return state

    return solve


def _skill_files() -> dict[str, str]:
    """Sample.files 로 sandbox 에 미리 주입할 skill 파일 맵.

    {sandbox 경로: 로컬 파일 경로}. Inspect 가 sandbox 생성 시 복사한다 —
    solver 단계의 write_file 보다 견고하다(VERIFY 의존 줄임).
    """
    files: dict[str, str] = {}
    if not SKILLS_SRC.is_dir():
        return files
    for skill_dir in sorted(SKILLS_SRC.iterdir()):
        if not skill_dir.is_dir():
            continue
        skill_md = skill_dir / "SKILL.md"
        if skill_md.exists():
            # VERIFY: Sample.files 의 값이 "로컬 경로"인지 "내용 문자열"인지
            # 설치본에서 확인. 경로 의미라면 그대로, 내용 의미라면
            # skill_md.read_text() 로 바꾼다.
            files[f".claude/skills/{skill_dir.name}/SKILL.md"] = str(skill_md)
    return files


# ----------------------------------------------------------------------
# 공통 agent solver — skill 을 쓰는 에이전트.
#   basic_agent 에 bash + text_editor tool 을 주고, system_message 로
#   "skill 절차를 따르라"고 못박는다. skill 자체는 sandbox 의
#   .claude/skills/ 에 있다.
# ----------------------------------------------------------------------
_SYSTEM = """\
너는 앱인토스(Apps in Toss) 미니앱 개발을 돕는 에이전트다.
작업 디렉토리의 .claude/skills/ 에 있는 skill 절차(SKILL.md)를 그대로 따른다.
사용자 요청에 해당하는 skill 을 찾아 그 "실행 순서"를 단계대로 수행하라.
파일 생성·편집은 text_editor, 명령 실행은 bash 를 쓴다.
네트워크가 필요한 단계(pnpm install 등)는 실패할 수 있으니, 실패하면
건너뛰고 파일 산출물 생성까지는 반드시 완료하라.
"""


def _agent_solver():
    # VERIFY: basic_agent 의 정확한 시그니처(tools=, ...). 설치본에서
    # `basic_agent(init=system_message(...), tools=[...])` 형태가 맞는지
    # 확인. message_limit 인자명도 확인(max_messages 일 수 있음).
    return basic_agent(
        init=system_message(_SYSTEM),
        tools=[bash(timeout=180), text_editor()],
        message_limit=40,
    )


# ======================================================================
# TASKS — 각 핵심 station 을 epochs 로 반복.
#   epochs 기본값은 task 에 박되, CLI --epochs 로 덮어쓸 수 있다.
# ======================================================================

# VERIFY: @task 데코레이터가 epochs 인자를 직접 받는지(아래처럼) 아니면
# Task(..., epochs=Epochs(5, "pass_at_1")) 로 넘기는지 설치본에서 확인.
# 두 경로 다 흔하다 — Epochs 객체로 reducer 까지 task 에 박는 쪽이 더 견고.


@task
def scaffold():
    """station 1 — /ait new 로 빈 상태에서 미니앱 스캐폴드."""
    sample = Sample(
        input=(
            "빈 디렉토리에서 시작해서, /ait new 절차로 'demo-shop' 이라는 "
            "앱인토스 미니앱 프로젝트를 스캐폴드해줘. 네트워크 설치가 실패하면 "
            "--no-install 처럼 install 단계는 건너뛰되, 파일은 모두 생성해."
        ),
        target="demo-shop",
        files=_skill_files(),
    )
    return Task(
        dataset=[sample],
        solver=_agent_solver(),
        scorer=scaffold_scorer(),
        # VERIFY: Epochs import 경로 — `from inspect_ai import Epochs`.
        # reducer 문자열("pass_at_1")이 CLI --epochs-reducer 와 같은 어휘인지
        # 확인. CLI 인자가 task 의 reducer 를 덮어쓴다.
        epochs=5,
        sandbox="docker",
    )


@task
def dev_ready():
    """station 2 — scaffold 후 dev 진입 준비(파일 조작이 실제로 일어남)."""
    sample = Sample(
        input=(
            "빈 디렉토리에서 /ait new 절차로 'demo-dev' 미니앱을 스캐폴드한 뒤, "
            "pnpm dev 로 바로 띄울 수 있는 상태인지 파일을 확인하고 필요한 "
            "설정 파일을 만들어줘. install 이 실패하면 파일 생성까지만."
        ),
        target="demo-dev",
        files=_skill_files(),
    )
    return Task(
        dataset=[sample],
        solver=_agent_solver(),
        scorer=edited_files_scorer(),
        epochs=5,
        sandbox="docker",
    )


@task
def bundle_build():
    """station 5 — scaffold 된 프로젝트에 /ait setup-bundle 로 .ait 번들 환경."""
    sample = Sample(
        input=(
            "먼저 /ait new 절차로 'demo-bundle' 미니앱을 스캐폴드해. "
            "그 프로젝트 디렉토리 안에서 /ait setup-bundle 절차를 수행해서 "
            ".ait 네이티브 번들 빌드 환경(granite.config.ts + bundle:ait "
            "스크립트 + @apps-in-toss/cli devDep)을 추가해줘. displayName 은 "
            "'데모 번들', primaryColor 는 기본값을 써. install 이 실패해도 "
            "설정 파일은 모두 생성해."
        ),
        target="demo-bundle",
        files=_skill_files(),
    )
    return Task(
        dataset=[sample],
        solver=_agent_solver(),
        scorer=setup_bundle_scorer(),
        epochs=5,
        sandbox="docker",
    )


# ----------------------------------------------------------------------
# 로컬 자기 점검 (Inspect 실행 아님):
#   `python eval/inspect/harness_completion.py` 로 돌리면 skill source 가
#   제자리에 있고 _skill_files() 가 비어있지 않은지만 확인한다. 실제 eval 은
#   위 `inspect eval ...` 명령으로 돈다.
# ----------------------------------------------------------------------
if __name__ == "__main__":
    files = _skill_files()
    if not files:
        raise SystemExit(
            f"skill source 를 못 찾음: {SKILLS_SRC} — repo 루트에서 실행 중인지 확인"
        )
    print(f"OK: {len(files)}개 SKILL.md 를 sandbox 주입 대상으로 확인")
    print(f"    skills source: {SKILLS_SRC}")
    print("    실제 eval 실행: inspect eval eval/inspect/harness_completion.py \\")
    print("        --model anthropic/claude-haiku-4-5 --epochs 5 --epochs-reducer pass_at_1")
