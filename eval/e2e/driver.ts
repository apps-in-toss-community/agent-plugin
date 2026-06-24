// eval/e2e — Suite B 드라이버
// ------------------------------------------------------------------
// 빈 격리 디렉토리에서 Claude Agent SDK 세션을 띄워 `/ait new` →
// (`/ait setup-bundle`) → 번들 빌드까지의 멀티턴 완주를 1회 실행하고,
// 토큰 사용량(modelUsage)·턴 수·도달 station·실패 분류를 수집한다.
//
// 안전 불변(plan §3):
//   - **build-only가 기본** — 콘솔 API를 아예 안 부른다. 31146 구조적 무접촉.
//   - register / deploy / auth-setup 슬래시 명령은 절대 디스패치하지 않는다
//     (register는 매 run 새 miniAppId를 서버 발급·자동 기록 → 반-패턴).
//   - 시크릿 값은 어떤 출력에도 싣지 않는다.
//
// 격리(plan §2):
//   - 매 run `mktemp -d` 임시 cwd. 그 안에 `.claude/skills`→`shared/skills`,
//     `.claude/commands`→`shared/commands` symlink (검증된 setup-fixture 패턴).
//   - settingSources: ['project'] 로 그 `.claude/`를 로드. (빈 배열이면 /ait 사라짐.)
//   - permissionMode: 'bypassPermissions' — 격리 임시 디렉토리라 권한 프롬프트 없이
//     파일 생성·Bash 실행 허용.

import { execFile } from 'node:child_process';
import { mkdtempSync, rmSync, symlinkSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { query } from '@anthropic-ai/claude-agent-sdk';
import { classifyFailure, scoreBuildOnly } from './score.ts';
import type { RunRecord, Task } from './types.ts';

const execFileAsync = promisify(execFile);

// repo root = eval/e2e/ 에서 두 단계 위.
const HERE = fileURLToPath(new URL('.', import.meta.url));
const REPO_ROOT = join(HERE, '..', '..');
const SKILLS_SRC = join(REPO_ROOT, 'shared', 'skills');
const COMMANDS_SRC = join(REPO_ROOT, 'shared', 'commands');

// 디스패치 금지 명령 — build-only 경로 밖. register는 새 앱 자동 생성(반-패턴),
// deploy/auth는 콘솔/인증 변이. 드라이버 프롬프트에 명시 + tools 게이트.
const FORBIDDEN_DISPATCH = ['/ait register', '/ait deploy', '/ait auth-setup'] as const;

export interface DriverOptions {
  task: Task;
  model: string;
  /** 0-based 반복 인덱스 (라벨·로그용). */
  iteration: number;
  /** run 종료 후 격리 디렉토리를 지우지 않고 보존 (디버깅). */
  keep?: boolean;
  /** init 메시지의 slash_commands/skills 키를 stderr로 로깅 (첫 실행 정밀화용). */
  logInit?: boolean;
  /** 안전 상한. 초과 시 error_max_turns 로 종료. */
  maxTurns?: number;
}

/** 격리 cwd에 .claude/{skills,commands} symlink를 깐다 (setup-fixture.sh 패턴). */
function linkClaudeDir(cwd: string): void {
  const claudeDir = join(cwd, '.claude');
  // mkdtemp 디렉토리는 이미 비어 있으므로 정리 불필요 — 바로 symlink.
  symlinkSync(SKILLS_SRC, join(claudeDir, 'skills'), 'dir');
  symlinkSync(COMMANDS_SRC, join(claudeDir, 'commands'), 'dir');
}

/**
 * 한 번의 완주 run을 실행한다. 절대 throw하지 않는다 — 실패는 RunRecord의
 * success:false + failClass로 표현해 호출자가 통계에 넣는다.
 */
export async function runOnce(opts: DriverOptions): Promise<RunRecord> {
  const { task, model, iteration } = opts;
  const maxTurns = opts.maxTurns ?? 60;
  const startedAt = Date.now();
  const workDir = mkdtempSync(join(tmpdir(), `ait-e2e-${task.id}-`));

  // 누적 신호.
  let initSeen = false;
  let initOk = false;
  let turns = 0;
  let modelUsage: RunRecord['modelUsage'] = {};
  let totalCostUsd = 0;
  let resultSubtype = '';
  let isError = false;
  let initSlashCommands: string[] = [];
  let initSkills: string[] = [];

  try {
    await mkdir(join(workDir, '.claude'), { recursive: true });
    linkClaudeDir(workDir);

    // build-only happy-path 프롬프트. 자연어 안내 + 명시적 슬래시 명령 디스패치.
    // 콘솔/인증/배포 명령은 금지 — 번들 빌드(.ait 생성)에서 멈춘다.
    const prompt = [
      `너는 빈 디렉토리에 있다. 아래 미니앱 아이디어를 앱인토스 미니앱으로 scaffold하고`,
      `로컬 번들(.ait)까지 빌드해라. 다음 순서로 진행한다:`,
      ``,
      `1. \`/ait new ${task.appName}\` 로 프로젝트를 생성한다.`,
      `2. 생성된 프로젝트 디렉토리로 들어가 \`/ait setup-bundle\` 로 번들 빌드 환경을 추가한다.`,
      `3. \`pnpm bundle:ait\` (= \`ait build\`) 로 \`.ait\` 번들을 생성한다.`,
      ``,
      `아이디어: ${task.prompt}`,
      ``,
      `중요 제약:`,
      `- 콘솔 등록/배포/로그인은 절대 하지 않는다. ${FORBIDDEN_DISPATCH.join(', ')} 를 실행하지 마라.`,
      `- 번들(.ait)이 생성되면 완료다. 거기서 멈춘다.`,
      `- 막혀도 멈추지 말고 다음 단계를 시도한다.`,
    ].join('\n');

    const response = query({
      prompt,
      options: {
        model,
        cwd: workDir,
        settingSources: ['project'],
        permissionMode: 'bypassPermissions',
        maxTurns,
        // 콘솔 자동화 CLI(aitcc) 호출을 막는 2차 게이트. 번들러(ait build)는
        // Bash로 돌지만 aitcc 콘솔 명령은 build-only 경로에 불필요.
        disallowedTools: ['mcp__ait-devtools'],
      },
    });

    for await (const message of response) {
      if (message.type === 'system' && message.subtype === 'init') {
        initSeen = true;
        initSlashCommands = message.slash_commands ?? [];
        initSkills = message.skills ?? [];
        // 느슨한 fail-fast: ait 계열 명령(또는 skill)이 하나라도 노출됐는가.
        // 다단어 명령 키 표현(`ait new` vs `ait` vs 파일명)은 미확정이라
        // 정확 매칭 대신 prefix 존재로 시작하고, --log-init 으로 실제 키를 본다.
        initOk =
          initSlashCommands.some((c) => c.includes('ait')) ||
          initSkills.some((s) => s.includes('new-miniapp') || s.includes('ait'));
        if (opts.logInit) {
          process.stderr.write(
            `[init] slash_commands=${JSON.stringify(initSlashCommands)}\n` +
              `[init] skills=${JSON.stringify(initSkills)}\n`,
          );
        }
        continue;
      }

      if (message.type === 'assistant') {
        turns += 1;
        continue;
      }

      if (message.type === 'result') {
        resultSubtype = message.subtype;
        isError = message.is_error;
        // modelUsage 는 SDK가 이미 message.id dedup한 누적값 — 직접 합산보다 신뢰.
        modelUsage = message.modelUsage ?? {};
        totalCostUsd = message.total_cost_usd ?? 0;
        if (typeof message.num_turns === 'number') turns = message.num_turns;
        break;
      }
    }

    // 결정적 채점 (콘솔 무접촉 — 파일 존재 + dep + build exit code).
    const score = await scoreBuildOnly({ workDir, task, execFileAsync });

    const wallMs = Date.now() - startedAt;
    const success = score.success && !isError;
    const failClass = success ? null : classifyFailure({ initSeen, initOk, resultSubtype, score });

    return {
      ts: startedAt,
      taskId: task.id,
      model,
      iteration,
      success,
      station: score.station,
      failClass,
      modelUsage,
      totalCostUsd,
      turns,
      wallMs,
      resultSubtype,
      initSlashCommands: opts.logInit ? initSlashCommands : undefined,
    };
  } catch (err) {
    // SDK/심링크/예기치 못한 throw — driver-error 로 기록하고 통계 유지.
    const wallMs = Date.now() - startedAt;
    return {
      ts: startedAt,
      taskId: task.id,
      model,
      iteration,
      success: false,
      station: 'none',
      failClass: 'driver-error',
      modelUsage,
      totalCostUsd,
      turns,
      wallMs,
      resultSubtype: resultSubtype || 'driver-throw',
      error: err instanceof Error ? err.message : String(err),
    };
  } finally {
    if (!opts.keep) {
      try {
        rmSync(workDir, { recursive: true, force: true });
      } catch {
        // 정리 실패는 무시 — 측정 결과에 영향 없음.
      }
    } else {
      process.stderr.write(`[keep] ${workDir}\n`);
    }
  }
}
