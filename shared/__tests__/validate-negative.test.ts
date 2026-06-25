/**
 * validate-negative.test.ts
 *
 * Fixture-based negative tests: 각 check 가 실제로 위반 시 fire 하는지 증명한다.
 *
 * 구조:
 *   buildValidFixture(dir)   — 최소한의 clean repo root 를 fs 에 직접 기록.
 *   rulesFired(violations)   — 위반 목록에서 rule ID 만 추출하는 헬퍼.
 *   각 테스트               — valid fixture 에서 시작 → 한 가지만 깨뜨림 → rule 발화 확인.
 *
 * clean baseline test 가 먼저 등장해 fixture 자체가 올바름을 단언한다.
 * 그 이후 각 negative case 는 그 baseline 위에서 one-thing-only 변이를 적용한다.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// 헬퍼: rule ID 목록 추출
// ---------------------------------------------------------------------------

type Violation = {
  file: string;
  line: number;
  rule: string;
  message: string;
  level: 'error' | 'warn';
};

function rulesFired(violations: Violation[]): string[] {
  return violations.map((v) => v.rule);
}

// ---------------------------------------------------------------------------
// 헬퍼: 최소 valid fixture 생성
//
// 픽스처 요건 요약 (validate-plugin.mjs 에서 직접 읽은 구조):
//   shared/skills/<name>/SKILL.md        — 올바른 frontmatter + 올바른 body
//   shared/commands/ait-<name>.md        — 올바른 frontmatter + skill 참조
//   shared/templates/<tpl>/template.json — 올바른 JSON + substitute files 존재
//   eval/promptfoo/promptfooconfig.yaml  — skills 블록에 skill name 포함
//   .claude-plugin/plugin.json           — version 일치
//   package.json                         — version 일치
//
// 주의: fixture 의 skill name 은 EXPECTED_CMD_TO_SKILL 에 없으므로 A1/routing-mismatch
// 가 발생한다 — 이는 "스냅샷이 픽스처 skill 을 모른다"는 정상 결과이고,
// hard-fail baseline test 에서 A1/routing-mismatch 는 허용 error 로 취급한다.
// A1/routing-mismatch 를 이번 negative test 에서 직접 시험할 때는 별도로 격리한다.
// ---------------------------------------------------------------------------

const SKILL_NAME = 'fix-skill'; // EXPECTED_CMD_TO_SKILL 에 없는 이름으로 고정
const CMD_FILE = `ait-${SKILL_NAME}.md`;

function writeFile(filePath: string, content: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

/**
 * 최소 valid SKILL.md 본문 (올바른 frontmatter + 올바른 body).
 * exempt 목록에 없는 skill 이므로 docs deep-link, seam 둘 다 필수.
 */
function validSkillMd(): string {
  return `---
name: ${SKILL_NAME}
description: Fixture skill for negative tests.
argument-hint: ''
---

# ${SKILL_NAME} skill

## 목적

픽스처 skill 이다.

<!-- docs deep-link (A2/docs-deeplink-required 통과용) -->
[가이드](https://docs.aitc.dev/guides/fixture-guide)

## 실행

\`\`\`
/ait new
\`\`\`

## 참고

- 없음
`;
}

/**
 * 최소 valid command 파일.
 */
function validCommandMd(argumentHint = ''): string {
  return `---
description: 'Fixture command.'
argument-hint: '${argumentHint}'
---

Load the \`${SKILL_NAME}\` skill.
`;
}

/**
 * 최소 valid template.json + substitute file.
 * substitute file 이름은 "config.md" — 토큰을 포함한다.
 */
const TPL_NAME = 'fix-tpl';
const TPL_SUBFILE = 'config.md';
const TPL_TOKEN = 'app_name';

function validTemplateJson(): string {
  return JSON.stringify({
    name: TPL_NAME,
    tokens: { [TPL_TOKEN]: { description: 'App name', example: 'My App' } },
    substitute: { files: [TPL_SUBFILE] },
  });
}

function validTemplateSubFile(): string {
  return `# {{${TPL_TOKEN}}}\n`;
}

/**
 * valid promptfoo config — skills 블록에 SKILL_NAME 포함.
 */
function validPromptfooYaml(): string {
  return `description: fixture eval
providers:
  - id: anthropic:claude-agent-sdk
    config:
      model: claude-sonnet-4-5
      setting_sources: ['project']
      working_dir: ./eval/promptfoo/fixture
      skills:
        - ${SKILL_NAME}
prompts:
  - '{{utterance}}'
tests: []
`;
}

/**
 * fixture root 에 최소 valid 파일들을 기록한다.
 */
function buildValidFixture(dir: string): void {
  // shared/skills
  writeFile(path.join(dir, 'shared', 'skills', SKILL_NAME, 'SKILL.md'), validSkillMd());

  // shared/commands
  writeFile(path.join(dir, 'shared', 'commands', CMD_FILE), validCommandMd(''));

  // shared/templates
  writeFile(path.join(dir, 'shared', 'templates', TPL_NAME, 'template.json'), validTemplateJson());
  writeFile(path.join(dir, 'shared', 'templates', TPL_NAME, TPL_SUBFILE), validTemplateSubFile());

  // eval/promptfoo
  writeFile(path.join(dir, 'eval', 'promptfoo', 'promptfooconfig.yaml'), validPromptfooYaml());

  // .claude-plugin/plugin.json + package.json — 버전 일치
  writeFile(
    path.join(dir, '.claude-plugin', 'plugin.json'),
    JSON.stringify({ name: 'ait', version: '0.1.0' }),
  );
  writeFile(
    path.join(dir, 'package.json'),
    JSON.stringify({ name: '@ait-co/agent-plugin', version: '0.1.0' }),
  );
}

// ---------------------------------------------------------------------------
// 테스트 픽스처 lifecycle
// ---------------------------------------------------------------------------

let tmpDir = '';

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ait-validate-fix-'));
});

afterEach(() => {
  if (tmpDir) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    tmpDir = '';
  }
});

// ---------------------------------------------------------------------------
// 임포트 (ESM dynamic import — vitest 환경)
// ---------------------------------------------------------------------------

// runChecks 를 동적 import 한다 (ESM). 전체 suite 에서 공유한다.
async function runChecks(dir: string): Promise<{ violations: Violation[]; hasErrors: boolean }> {
  const { runChecks: fn } = (await import('../../scripts/validate-plugin.mjs')) as {
    runChecks: (root: string) => { violations: Violation[]; hasErrors: boolean };
  };
  return fn(dir);
}

// ---------------------------------------------------------------------------
// 베이스라인: valid fixture 는 hard-fail (error-level, non-routing) 을 내지 않는다
// ---------------------------------------------------------------------------

/**
 * A1/routing-mismatch 는 픽스처 skill 이 EXPECTED_CMD_TO_SKILL 에 없어서 항상 발생한다.
 * 이것은 픽스처 설계상 불가피한 "허용된 노이즈"이므로 hard-fail baseline 에서 제외한다.
 * 이 제외 처리는 "fixture-internal routing 불일치"를 무시하는 것이 맞는지 확인하기 위해
 * 명시적으로 문서화한다.
 */
function hardFailsExcludingRoutingNoise(violations: Violation[]): Violation[] {
  return violations.filter(
    (v) =>
      v.level === 'error' &&
      !v.rule.startsWith('A4/') && // CI 에서 console-cli 없음
      v.rule !== 'A1/routing-mismatch', // 픽스처 skill 이 스냅샷에 없음 — 의도된 노이즈
  );
}

describe('validate-plugin — fixture baseline', () => {
  it('valid fixture 는 hard-fail (routing noise 제외) 이 없어야 한다', async () => {
    buildValidFixture(tmpDir);
    const { violations } = await runChecks(tmpDir);
    const hardFails = hardFailsExcludingRoutingNoise(violations);

    if (hardFails.length > 0) {
      const lines = hardFails.map((v) => `  ${v.file}:${v.line}  [${v.rule}]  ${v.message}`);
      throw new Error(`fixture baseline 에 unexpected hard-fail 발생:\n${lines.join('\n')}`);
    }

    expect(hardFails).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// A1 — frontmatter + 1:1 매핑 + 라우팅
// ---------------------------------------------------------------------------

describe('A1 negative tests', () => {
  it('A1/skill-orphan — command 없는 skill 은 orphan 위반을 낸다', async () => {
    buildValidFixture(tmpDir);
    // command 파일 제거 → skill 은 있지만 매핑 command 없음
    fs.rmSync(path.join(tmpDir, 'shared', 'commands', CMD_FILE));
    const { violations } = await runChecks(tmpDir);
    expect(rulesFired(violations)).toContain('A1/skill-orphan');
  });

  it('A1/routing-mismatch — command 가 스냅샷에 없는 skill 을 참조하면 routing-mismatch 가 난다', async () => {
    buildValidFixture(tmpDir);
    // 이미 EXPECTED_CMD_TO_SKILL 에 없는 CMD_FILE → routing-mismatch 가 항상 발생
    const { violations } = await runChecks(tmpDir);
    expect(rulesFired(violations)).toContain('A1/routing-mismatch');
  });

  it('A1/argument-hint-mismatch — command 와 skill 의 argument-hint 가 다르면 위반이 난다', async () => {
    buildValidFixture(tmpDir);
    // command 의 argument-hint 만 변경 (skill 은 '' 유지)
    writeFile(
      path.join(tmpDir, 'shared', 'commands', CMD_FILE),
      validCommandMd('<app-name>'), // skill 은 '' 인데 command 만 다르게
    );
    const { violations } = await runChecks(tmpDir);
    expect(rulesFired(violations)).toContain('A1/argument-hint-mismatch');
  });
});

// ---------------------------------------------------------------------------
// A2 — 본문 구조 + seam
// ---------------------------------------------------------------------------

describe('A2 negative tests', () => {
  it('A2/wrong-first-h2-heading — 첫 H2 가 ## 목적 이 아니면 위반이 난다', async () => {
    buildValidFixture(tmpDir);
    const broken = `---
name: ${SKILL_NAME}
description: Fixture skill.
argument-hint: ''
---

# ${SKILL_NAME} skill

## 개요

다른 제목으로 시작하면 안 된다.

[가이드](https://docs.aitc.dev/guides/fixture-guide)

\`\`\`
/ait new
\`\`\`
`;
    writeFile(path.join(tmpDir, 'shared', 'skills', SKILL_NAME, 'SKILL.md'), broken);
    const { violations } = await runChecks(tmpDir);
    expect(rulesFired(violations)).toContain('A2/wrong-first-h2-heading');
  });

  it('A2/blockquote-after-heading — 첫 heading 직후 > blockquote 는 위반이 난다', async () => {
    buildValidFixture(tmpDir);
    const broken = `---
name: ${SKILL_NAME}
description: Fixture skill.
argument-hint: ''
---

# ${SKILL_NAME} skill

> 이건 금지된 blockquote 다.

## 목적

본문.

[가이드](https://docs.aitc.dev/guides/fixture-guide)

\`\`\`
/ait new
\`\`\`
`;
    writeFile(path.join(tmpDir, 'shared', 'skills', SKILL_NAME, 'SKILL.md'), broken);
    const { violations } = await runChecks(tmpDir);
    expect(rulesFired(violations)).toContain('A2/blockquote-after-heading');
  });

  it('A2/docs-root-link — docs.aitc.dev 루트 링크는 위반이 난다', async () => {
    buildValidFixture(tmpDir);
    const broken = `---
name: ${SKILL_NAME}
description: Fixture skill.
argument-hint: ''
---

# ${SKILL_NAME} skill

## 목적

본문.

[전체 문서](https://docs.aitc.dev)

\`\`\`
/ait new
\`\`\`
`;
    writeFile(path.join(tmpDir, 'shared', 'skills', SKILL_NAME, 'SKILL.md'), broken);
    const { violations } = await runChecks(tmpDir);
    expect(rulesFired(violations)).toContain('A2/docs-root-link');
  });

  it('A2/docs-deeplink-required — docs deep-link 없으면 위반이 난다', async () => {
    buildValidFixture(tmpDir);
    // deep-link 없이 seam 만 있는 SKILL.md
    const broken = `---
name: ${SKILL_NAME}
description: Fixture skill.
argument-hint: ''
---

# ${SKILL_NAME} skill

## 목적

본문. 링크 없음.

\`\`\`
/ait new
\`\`\`
`;
    writeFile(path.join(tmpDir, 'shared', 'skills', SKILL_NAME, 'SKILL.md'), broken);
    const { violations } = await runChecks(tmpDir);
    expect(rulesFired(violations)).toContain('A2/docs-deeplink-required');
  });

  it('A2/no-seam — ## 참고 이전 본문에 /ait 참조가 없으면 위반이 난다', async () => {
    buildValidFixture(tmpDir);
    // seam 을 ## 참고 뒤로 이동하거나 완전히 제거
    const broken = `---
name: ${SKILL_NAME}
description: Fixture skill.
argument-hint: ''
---

# ${SKILL_NAME} skill

## 목적

본문. seam 없음.

[가이드](https://docs.aitc.dev/guides/fixture-guide)

## 참고

- 없음
`;
    writeFile(path.join(tmpDir, 'shared', 'skills', SKILL_NAME, 'SKILL.md'), broken);
    const { violations } = await runChecks(tmpDir);
    expect(rulesFired(violations)).toContain('A2/no-seam');
  });

  it('A2/seam-not-printed — /ait 가 산문에만 있고 fenced block 에 없으면 위반이 난다', async () => {
    buildValidFixture(tmpDir);
    // fenced block 밖 산문에만 /ait 언급
    const broken = `---
name: ${SKILL_NAME}
description: Fixture skill.
argument-hint: ''
---

# ${SKILL_NAME} skill

## 목적

본문. 다음으로 /ait new 를 실행하세요 (산문에만 있음).

[가이드](https://docs.aitc.dev/guides/fixture-guide)
`;
    writeFile(path.join(tmpDir, 'shared', 'skills', SKILL_NAME, 'SKILL.md'), broken);
    const { violations } = await runChecks(tmpDir);
    // /ait 가 존재하므로 no-seam 이 아닌 seam-not-printed 가 발화해야 한다
    expect(rulesFired(violations)).toContain('A2/seam-not-printed');
    expect(rulesFired(violations)).not.toContain('A2/no-seam');
  });
});

// ---------------------------------------------------------------------------
// A3 — 템플릿 + eval 동기화
// ---------------------------------------------------------------------------

describe('A3 negative tests', () => {
  it('A3/token-in-tsx — .tsx 파일에 {{token}} 이 있으면 위반이 난다', async () => {
    buildValidFixture(tmpDir);
    // .tsx 파일에 토큰 추가
    writeFile(
      path.join(tmpDir, 'shared', 'templates', TPL_NAME, 'App.tsx'),
      `export default function App() { return <div>{{${TPL_TOKEN}}}</div>; }\n`,
    );
    const { violations } = await runChecks(tmpDir);
    expect(rulesFired(violations)).toContain('A3/token-in-tsx');
  });

  it('A3/token-used-not-declared — substitute file 에서 쓰는 토큰이 template.json tokens 에 없으면 위반이 난다', async () => {
    buildValidFixture(tmpDir);
    // substitute file 에 미선언 토큰 추가
    writeFile(
      path.join(tmpDir, 'shared', 'templates', TPL_NAME, TPL_SUBFILE),
      `# {{${TPL_TOKEN}}}\n\nUndeclared: {{undeclared_token}}\n`,
    );
    const { violations } = await runChecks(tmpDir);
    expect(rulesFired(violations)).toContain('A3/token-used-not-declared');
  });

  it('A3/promptfoo-skill-missing — disk skill 이 promptfooconfig.yaml 에 없으면 위반이 난다', async () => {
    buildValidFixture(tmpDir);
    // promptfoo yaml 에서 SKILL_NAME 제거
    const yamlWithoutSkill = `description: fixture eval
providers:
  - id: anthropic:claude-agent-sdk
    config:
      model: claude-sonnet-4-5
      setting_sources: ['project']
      working_dir: ./eval/promptfoo/fixture
      skills:
        - other-skill-not-on-disk
prompts:
  - '{{utterance}}'
tests: []
`;
    writeFile(path.join(tmpDir, 'eval', 'promptfoo', 'promptfooconfig.yaml'), yamlWithoutSkill);
    const { violations } = await runChecks(tmpDir);
    // disk 에 SKILL_NAME 있지만 yaml 에 없음 → promptfoo-skill-missing
    expect(rulesFired(violations)).toContain('A3/promptfoo-skill-missing');
  });
});

// ---------------------------------------------------------------------------
// A5 — plugin.json ↔ package.json 버전 드리프트
// ---------------------------------------------------------------------------

describe('A5 negative tests', () => {
  it('A5/plugin-json-version-drift — plugin.json 버전이 package.json 과 다르면 위반이 난다', async () => {
    buildValidFixture(tmpDir);
    // plugin.json 버전만 다르게
    writeFile(
      path.join(tmpDir, '.claude-plugin', 'plugin.json'),
      JSON.stringify({ name: 'ait', version: '0.0.1' }), // package.json 은 0.1.0
    );
    const { violations } = await runChecks(tmpDir);
    expect(rulesFired(violations)).toContain('A5/plugin-json-version-drift');
  });
});

// ---------------------------------------------------------------------------
// A7 — mcpServers npx args 해석 가능성
// ---------------------------------------------------------------------------

describe('A7 negative tests', () => {
  it('A7/mcp-npx-bare-bin — npx args 가 -p 없이 패키지+bin 토큰을 두면 위반이 난다', async () => {
    buildValidFixture(tmpDir);
    // bare form: ["-y", "<pkg>", "<bin>"] — npm 이 bin 을 추론해야 해서 모호.
    writeFile(
      path.join(tmpDir, '.claude-plugin', 'plugin.json'),
      JSON.stringify({
        name: 'ait',
        version: '0.1.0', // package.json 과 일치 (A5 격리)
        mcpServers: {
          'ait-devtools': { command: 'npx', args: ['-y', '@ait-co/devtools', 'devtools-mcp'] },
        },
      }),
    );
    const { violations } = await runChecks(tmpDir);
    expect(rulesFired(violations)).toContain('A7/mcp-npx-bare-bin');
  });

  it('A7/mcp-npx-bare-bin — -p/--package 형태는 발화하지 않는다 (positive control)', async () => {
    buildValidFixture(tmpDir);
    // 올바른 form: ["-y", "-p", "<pkg>", "<bin>"] — bin 추론 모호성 없음.
    writeFile(
      path.join(tmpDir, '.claude-plugin', 'plugin.json'),
      JSON.stringify({
        name: 'ait',
        version: '0.1.0',
        mcpServers: {
          'ait-devtools': {
            command: 'npx',
            args: ['-y', '-p', '@ait-co/devtools', 'devtools-mcp'],
          },
        },
      }),
    );
    const { violations } = await runChecks(tmpDir);
    expect(rulesFired(violations)).not.toContain('A7/mcp-npx-bare-bin');
  });
});
