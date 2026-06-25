/**
 * validate-plugin.mjs
 *
 * 구조 검증기 — shared/{skills,commands,templates} + eval/ 의 정합성을 확인.
 * 6개 그룹으로 나뉜다:
 *   A1 — frontmatter + 1:1 매핑 + 라우팅 스냅샷 (hard-fail)
 *   A2 — 본문 구조 + seam 검사 (hard-fail)
 *   A3 — 템플릿 + eval 동기화 (hard-fail)
 *   A4 — CLI 토큰 크로스체크 (optional warn, ../console-cli 없으면 skip)
 *   A5 — plugin.json ↔ package.json 버전 드리프트 (hard-fail)
 *   A6 — 링크 liveness (opt-in warn, VALIDATE_LINKS=1 일 때만 — *.aitc.dev 200 확인)
 *
 * A1–A5 는 runChecks() 가 동기로 돈다(기본 `pnpm test` 경로, 네트워크 비의존).
 * A6 는 네트워크라 CLI 진입점에서만 비동기로 돌고, VALIDATE_LINKS=1 이 아니면 skip.
 *
 * CLI:           node scripts/validate-plugin.mjs        (A1–A5; A6 skip)
 *                VALIDATE_LINKS=1 node scripts/validate-plugin.mjs   (+ A6 링크 sweep)
 * API: import { runChecks } from './scripts/validate-plugin.mjs'
 *      const { violations } = runChecks(repoRoot)        (A1–A5, 동기)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------------------------
// 유틸: YAML frontmatter 파서 (의존성 없는 최소 구현)
// ---------------------------------------------------------------------------

/**
 * `---\n...\n---` 블록을 파싱해 key->value 맵을 반환한다.
 * 지원:
 *   - 단순 스칼라: `key: value`
 *   - 빈 문자열: `key: ''` 또는 `key: ""`
 *   - 블록 스칼라 (|): `key: |\n  line1\n  line2`
 *
 * @param {string} src 파일 전체 텍스트
 * @returns {{ fm: Record<string,string>, body: string } | null}
 */
function parseFrontmatter(src) {
  if (!src.startsWith('---')) return null;
  const second = src.indexOf('\n---', 3);
  if (second === -1) return null;

  const fmRaw = src.slice(4, second);
  const fmEnd = second + 4;
  const body = src.slice(fmEnd);

  /** @type {Record<string,string>} */
  const fm = {};
  const lines = fmRaw.split('\n');
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const m = line.match(/^([a-zA-Z_-][a-zA-Z0-9_-]*):\s*(.*)/);
    if (!m) {
      i++;
      continue;
    }
    const key = m[1];
    const rest = m[2].trim();

    if (rest === '|') {
      i++;
      const blockLines = [];
      while (i < lines.length && (lines[i].startsWith('  ') || lines[i] === '')) {
        blockLines.push(lines[i].replace(/^ {2}/, ''));
        i++;
      }
      fm[key] = blockLines.join('\n').trimEnd();
    } else {
      const unquoted = rest.replace(/^['"]|['"]$/g, '');
      fm[key] = unquoted;
      i++;
    }
  }
  return { fm, body };
}

// ---------------------------------------------------------------------------
// 유틸: 파일 시스템 헬퍼
// ---------------------------------------------------------------------------

/** @param {string} filePath @returns {string} */
function readFile(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

/** @param {string} dir @returns {string[]} */
function listDirs(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name);
}

/** @param {string} dir @returns {string[]} */
function listFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => e.name);
}

// ---------------------------------------------------------------------------
// Violation 타입
// ---------------------------------------------------------------------------

/**
 * @typedef {{ file: string, line: number, rule: string, message: string, level: 'error' | 'warn' }} Violation
 */

/**
 * @param {string} file
 * @param {number} line
 * @param {string} rule
 * @param {string} message
 * @param {'error'|'warn'} level
 * @returns {Violation}
 */
function mkv(file, line, rule, message, level = 'error') {
  return { file, line, rule, message, level };
}

// ---------------------------------------------------------------------------
// A1 — frontmatter + 1:1 매핑
// ---------------------------------------------------------------------------

/** @param {string} root @returns {Violation[]} */
function checkA1(root) {
  const violations = [];

  const skillsDir = path.join(root, 'shared', 'skills');
  const commandsDir = path.join(root, 'shared', 'commands');

  const skillDirs = listDirs(skillsDir);
  const commandFiles = listFiles(commandsDir).filter((f) => f.endsWith('.md'));

  // EXCEPTION: changeset는 ait- prefix 면제 메인테이너 도구
  const EXEMPT_COMMAND = 'changeset.md';

  // skill frontmatter 수집
  /** @type {Map<string, { argumentHint: string, filePath: string, hasArgumentHint: boolean }>} */
  const skillMeta = new Map();

  for (const skillName of skillDirs) {
    const skillFile = path.join(skillsDir, skillName, 'SKILL.md');
    if (!fs.existsSync(skillFile)) {
      violations.push(
        mkv(path.join('shared', 'skills', skillName), 1, 'A1/skill-no-file', 'SKILL.md 없음'),
      );
      continue;
    }
    const src = readFile(skillFile);
    const parsed = parseFrontmatter(src);
    const relFile = path.relative(root, skillFile);

    if (!parsed) {
      violations.push(mkv(relFile, 1, 'A1/skill-no-frontmatter', 'frontmatter 없음'));
      continue;
    }
    const { fm } = parsed;

    if (!fm.name) {
      violations.push(
        mkv(
          relFile,
          1,
          'A1/skill-name-missing',
          `frontmatter에 'name' 없음 (fix: name: ${skillName} 추가)`,
        ),
      );
    } else if (fm.name !== skillName) {
      violations.push(
        mkv(
          relFile,
          1,
          'A1/skill-name-mismatch',
          `name '${fm.name}' != 디렉토리 '${skillName}' (fix: name: ${skillName})`,
        ),
      );
    }

    const hasArgumentHint = 'argument-hint' in fm;
    if (!hasArgumentHint) {
      violations.push(
        mkv(
          relFile,
          1,
          'A1/skill-argument-hint-missing',
          `frontmatter에 'argument-hint' 없음 (fix: argument-hint: '' 추가)`,
        ),
      );
    }

    skillMeta.set(skillName, {
      argumentHint: fm['argument-hint'] ?? '',
      filePath: relFile,
      hasArgumentHint,
    });
  }

  // command frontmatter + skill 참조 수집
  /** @type {Map<string, { skillName: string, argumentHint: string, filePath: string }>} */
  const commandMeta = new Map();

  for (const cmdFile of commandFiles) {
    const isExempt = cmdFile === EXEMPT_COMMAND;
    const relFile = path.join('shared', 'commands', cmdFile);
    const fullFile = path.join(commandsDir, cmdFile);
    const src = readFile(fullFile);
    const parsed = parseFrontmatter(src);

    if (!parsed) {
      violations.push(mkv(relFile, 1, 'A1/cmd-no-frontmatter', 'frontmatter 없음'));
      continue;
    }
    const { fm, body } = parsed;

    if (!fm.description) {
      violations.push(
        mkv(relFile, 1, 'A1/cmd-description-missing', `frontmatter에 'description' 없음`),
      );
    }
    if (!('argument-hint' in fm)) {
      violations.push(
        mkv(
          relFile,
          1,
          'A1/cmd-argument-hint-missing',
          `frontmatter에 'argument-hint' 없음 (fix: argument-hint: '' 추가)`,
        ),
      );
    }

    if (!isExempt && !cmdFile.startsWith('ait-')) {
      violations.push(
        mkv(relFile, 1, 'A1/cmd-no-ait-prefix', `명령 파일명이 'ait-' 로 시작하지 않음`),
      );
    }

    // skill 참조 파싱: "Load the `<skill>` skill" 또는 "Load the <skill> skill"
    const match = body.match(/Load the `?([a-zA-Z0-9_-]+)`? skill/);
    if (!match) {
      violations.push(
        mkv(
          relFile,
          1,
          'A1/cmd-no-skill-ref',
          `본문에서 skill 참조를 찾을 수 없음 (패턴: "Load the <skill> skill")`,
        ),
      );
      continue;
    }
    const referencedSkill = match[1];

    // argument-hint 동기화 검증
    const skillInfo = skillMeta.get(referencedSkill);
    if (skillInfo?.hasArgumentHint && 'argument-hint' in fm) {
      if (fm['argument-hint'] !== skillInfo.argumentHint) {
        violations.push(
          mkv(
            relFile,
            1,
            'A1/argument-hint-mismatch',
            `argument-hint '${fm['argument-hint']}' != skill '${referencedSkill}' 의 '${skillInfo.argumentHint}' (fix: 두 파일 동기화)`,
          ),
        );
      }
    }

    commandMeta.set(cmdFile, {
      skillName: referencedSkill,
      argumentHint: fm['argument-hint'] ?? '',
      filePath: relFile,
    });
  }

  // 1:1 매핑 검증: 각 command가 참조하는 skill이 존재하는지
  for (const [, meta] of commandMeta) {
    if (!skillMeta.has(meta.skillName)) {
      violations.push(
        mkv(
          meta.filePath,
          1,
          'A1/cmd-orphan-skill-ref',
          `명령이 참조하는 skill '${meta.skillName}' 이 shared/skills/ 에 없음`,
        ),
      );
    }
  }

  // 각 skill에 대응하는 command가 있는지
  const referencedSkills = new Set(Array.from(commandMeta.values()).map((m) => m.skillName));
  for (const skillName of skillDirs) {
    if (!referencedSkills.has(skillName)) {
      const relFile = path.join('shared', 'skills', skillName, 'SKILL.md');
      violations.push(
        mkv(relFile, 1, 'A1/skill-orphan', `skill '${skillName}' 에 대응하는 명령 파일이 없음`),
      );
    }
  }

  // 각 skill이 두 개 이상의 command에서 참조되는지 (중복)
  /** @type {Map<string, number>} */
  const skillCommandCount = new Map();
  for (const [, meta] of commandMeta) {
    const cnt = (skillCommandCount.get(meta.skillName) ?? 0) + 1;
    skillCommandCount.set(meta.skillName, cnt);
  }
  for (const [skillName, cnt] of skillCommandCount) {
    if (cnt > 1) {
      const relFile = path.join('shared', 'skills', skillName, 'SKILL.md');
      violations.push(
        mkv(
          relFile,
          1,
          'A1/skill-multi-cmd',
          `skill '${skillName}' 이 ${cnt}개 명령에서 참조됨 (1:1 위반)`,
        ),
      );
    }
  }

  // 라우팅 스냅샷 검증: commandMeta 가 EXPECTED_CMD_TO_SKILL 과 일치하는지
  for (const [cmdFile, expectedSkill] of Object.entries(EXPECTED_CMD_TO_SKILL)) {
    const actual = commandMeta.get(cmdFile);
    if (!actual) {
      violations.push(
        mkv(
          path.join('shared', 'commands', cmdFile),
          1,
          'A1/routing-mismatch',
          `라우팅 스냅샷: '${cmdFile}' 가 shared/commands/ 에 없음 (fix: 파일 추가 또는 EXPECTED_CMD_TO_SKILL 갱신)`,
        ),
      );
    } else if (actual.skillName !== expectedSkill) {
      violations.push(
        mkv(
          actual.filePath,
          1,
          'A1/routing-mismatch',
          `라우팅 스냅샷 불일치: '${cmdFile}' 가 skill '${actual.skillName}' 을 참조하지만 기대값은 '${expectedSkill}' (fix: skill 참조 또는 EXPECTED_CMD_TO_SKILL 갱신)`,
        ),
      );
    }
  }
  for (const [cmdFile] of commandMeta) {
    if (!(cmdFile in EXPECTED_CMD_TO_SKILL)) {
      violations.push(
        mkv(
          path.join('shared', 'commands', cmdFile),
          1,
          'A1/routing-mismatch',
          `라우팅 스냅샷: '${cmdFile}' 가 EXPECTED_CMD_TO_SKILL 에 없음 (fix: 상수에 항목 추가)`,
        ),
      );
    }
  }

  return violations;
}

// ---------------------------------------------------------------------------
// A2 — 본문 구조
// ---------------------------------------------------------------------------

// seam 검사 면제 skill: harness 외부 메인테이너 도구 (next-station seam 없음이 정상)
const SEAM_EXEMPT_SKILLS = new Set(['changeset']);

/**
 * fenced code block 안에 있는 라인 번호(1-based) 집합을 반환한다.
 * @param {string[]} lines
 * @returns {Set<number>}
 */
function fencedCodeLineNumbers(lines) {
  const inFence = new Set();
  let insideFence = false;
  let fenceChar = '';
  let fenceLen = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!insideFence) {
      const m = line.match(/^(`{3,}|~{3,})/);
      if (m) {
        insideFence = true;
        fenceChar = m[1][0];
        fenceLen = m[1].length;
      }
    } else {
      // closing fence: same char, at least same length, optional trailing whitespace
      const closeRe = new RegExp(`^${fenceChar === '`' ? '`' : '~'}{${fenceLen},}\\s*$`);
      if (closeRe.test(line)) {
        insideFence = false;
        fenceChar = '';
        fenceLen = 0;
      } else {
        inFence.add(i + 1);
      }
    }
  }
  return inFence;
}

// docs link allowlist: welcome + new-miniapp 는 /intro 링크 허용
const DOCS_LINK_ALLOWLIST = new Set(['welcome', 'new-miniapp']);

// A2 deep-link-required (positive) allowlist — §1.3.4("skill 말미 docs 링크는
// docs.aitc.dev/<주제>로 deep-link 필수")를 코드로 강제하되, deep-link 의무가
// 면제되는 skill 을 명시한다. 면제 사유 3종 + 임시 1종:
//   1. entry/scaffold (welcome·new-miniapp): docs 루트 링크가 적절 (§1.2 예외)
//   2. harness-external (changeset): /ait prefix 예외, docs 주제 페이지 무관
//   3. docs 로더 자체 (docs): self-link 가 무의미
//   4. [임시] 대상 docs 페이지 미존재 (ship/operate/dev-setup 8종):
//      deploy·deploy-key·register·setup-bundle·setup-phone-preview·status·
//      inject-devtools·inject-polyfill. 지금 deep-link 를 박으면 404 — 무링크보다
//      나쁘다. docs repo 에 해당 guide 가 authoring 되면(issue #200 Layer 3) 이
//      8개를 이 set 에서 제거한다. 그때까지 "링크 없음"은 의도된 상태.
const DOCS_DEEPLINK_EXEMPT = new Set([
  'welcome',
  'new-miniapp',
  'changeset',
  'docs',
  // 임시 — issue #200 Layer 3 (docs page authoring) 완료 시 제거.
  // ship(setup-bundle·register·deploy-key·deploy)·operate(status) 5종은
  // docs guides/ship-mini-app·operate-mini-app 신설(docs #116)로 deep-link
  // 타깃이 생겨 set 에서 제거됐다. 남은 3종은 dev-setup 주제 guide 미존재:
  //   setup-phone-preview(환경 2 PWA), inject-devtools/inject-polyfill.
  'setup-phone-preview',
  'inject-devtools',
  'inject-polyfill',
]);

// docs deep-link 형태: docs.aitc.dev/guides/<slug> 또는 docs.aitc.dev/api/<group>[/<method>]
const DOCS_DEEPLINK_RE = /docs\.aitc\.dev\/(guides|api)\/[a-zA-Z0-9][a-zA-Z0-9/_-]*/;

// ---------------------------------------------------------------------------
// A1 라우팅 스냅샷 — 명령 파일 ↔ skill 매핑 기대값
// shared/commands/ 전수를 열거한다. 변경 시 이 상수도 함께 갱신.
// ---------------------------------------------------------------------------

/** @type {Record<string, string>} */
const EXPECTED_CMD_TO_SKILL = {
  'ait-auth-setup.md': 'auth-setup',
  'ait-debug.md': 'debug',
  'ait-deploy-key.md': 'deploy-key',
  'ait-deploy.md': 'deploy',
  'ait-design.md': 'design',
  'ait-docs.md': 'docs',
  'ait-inject-devtools.md': 'inject-devtools',
  'ait-inject-polyfill.md': 'inject-polyfill',
  'ait-logs.md': 'logs',
  'ait-new.md': 'new-miniapp',
  'ait-plan.md': 'plan',
  'ait-register.md': 'register',
  'ait-setup-bundle.md': 'setup-bundle',
  'ait-setup-phone-preview.md': 'setup-phone-preview',
  'ait-status.md': 'status',
  'ait-welcome.md': 'welcome',
  'changeset.md': 'changeset',
};

/** @param {string} root @returns {Violation[]} */
function checkA2(root) {
  const violations = [];
  const skillsDir = path.join(root, 'shared', 'skills');
  const skillDirs = listDirs(skillsDir);

  for (const skillName of skillDirs) {
    const skillFile = path.join(skillsDir, skillName, 'SKILL.md');
    if (!fs.existsSync(skillFile)) continue;

    const relFile = path.relative(root, skillFile);
    const src = readFile(skillFile);
    const parsed = parseFrontmatter(src);
    if (!parsed) continue;

    const { body } = parsed;
    const srcLines = src.split('\n');
    const bodyLines = body.split('\n');

    // 첫 번째 H2 heading은 ## 목적 이어야 한다 (H1 skill-title 은 제외)
    const firstH2Line = bodyLines.find((l) => l.startsWith('## ') || l.trim() === '##');
    if (firstH2Line === undefined) {
      violations.push(mkv(relFile, 1, 'A2/no-h2-heading', '## 목적 H2 heading 없음'));
    } else if (firstH2Line.trim() !== '## 목적') {
      const headingLineNo = srcLines.findIndex((l) => l.startsWith('## ') || l.trim() === '##') + 1;
      violations.push(
        mkv(
          relFile,
          headingLineNo,
          'A2/wrong-first-h2-heading',
          `첫 H2 heading이 '## 목적' 이어야 함, 실제: '${firstH2Line.trim()}' (fix: ## 목적 으로 시작하도록)`,
        ),
      );
    }

    // 첫 heading 직후 > blockquote 금지
    {
      let foundFirstH = false;
      for (let i = 0; i < srcLines.length; i++) {
        const line = srcLines[i];
        if (!foundFirstH && line.startsWith('#')) {
          foundFirstH = true;
          continue;
        }
        if (foundFirstH) {
          if (line.trim() === '') continue;
          if (line.startsWith('>')) {
            violations.push(
              mkv(
                relFile,
                i + 1,
                'A2/blockquote-after-heading',
                `첫 heading 직후 '>' blockquote 금지 (umbrella §1.3 규칙 7)`,
              ),
            );
          }
          break;
        }
      }
    }

    // fenced block 내 ✅ 선행 이모지 검출
    {
      const fencedLines = fencedCodeLineNumbers(srcLines);
      for (const lineNo of fencedLines) {
        const line = srcLines[lineNo - 1];
        if (line.startsWith('✅')) {
          // ✅
          violations.push(
            mkv(
              relFile,
              lineNo,
              'A2/emoji-in-completion-block',
              `완료 블록 출력에 ✅ 이모지 선행 금지 (fix: '✅ ' 제거, 단순 텍스트로)`,
            ),
          );
        }
      }
    }

    // docs 링크 루트/intro 검출 (allowlist 제외)
    if (!DOCS_LINK_ALLOWLIST.has(skillName)) {
      for (let i = 0; i < srcLines.length; i++) {
        const line = srcLines[i];
        if (
          line.includes('docs.aitc.dev/intro') ||
          /docs\.aitc\.dev\/?\s*[)\]'"\s]/.test(line) ||
          /docs\.aitc\.dev\/$/.test(line)
        ) {
          violations.push(
            mkv(
              relFile,
              i + 1,
              'A2/docs-root-link',
              `docs.aitc.dev 루트/intro 링크 금지 — 주제별 deep-link 사용 (fix: docs.aitc.dev/guides/<slug> 등으로)`,
            ),
          );
        }
      }
    }

    // docs deep-link 존재 강제 (positive — §1.3.4 "deep-link 필수"를 코드로):
    // exempt 가 아닌 skill 은 본문 어딘가에 docs.aitc.dev/(guides|api)/<slug>
    // deep-link 가 최소 1개 있어야 한다. (음성 검사 A2/docs-root-link 와 짝 — 그건
    // "루트 링크 금지", 이건 "deep-link 있어야 함". 둘 다 통과해야 §1.3.4 충족.)
    if (!DOCS_DEEPLINK_EXEMPT.has(skillName)) {
      if (!DOCS_DEEPLINK_RE.test(src)) {
        violations.push(
          mkv(
            relFile,
            1,
            'A2/docs-deeplink-required',
            `docs deep-link 없음 — §1.3.4 위반. 본문에 docs.aitc.dev/guides/<slug> 또는 docs.aitc.dev/api/<group> 링크 필요 (대상 페이지가 아직 없으면 DOCS_DEEPLINK_EXEMPT 에 임시 등재 + issue #200 Layer 3 추적)`,
          ),
        );
      }
    }

    // next-station seam 검사: ## Out of scope / ## 참고 이전 본문에 /ait 가 있어야 한다.
    // read-only skill(status·logs)도 분기 표에서 /ait 를 참조하므로 자연히 통과한다.
    if (!SEAM_EXEMPT_SKILLS.has(skillName)) {
      // 본문에서 ## Out of scope 또는 ## 참고 이전 영역만 검사
      const seamBodyEndIdx = bodyLines.findIndex(
        (l) => l.startsWith('## Out of scope') || l.startsWith('## 참고'),
      );
      const seamBody = seamBodyEndIdx === -1 ? body : bodyLines.slice(0, seamBodyEndIdx).join('\n');
      if (!seamBody.includes('/ait ')) {
        violations.push(
          mkv(
            relFile,
            1,
            'A2/no-seam',
            `다음 station 세am 없음: skill 본문(## Out of scope / ## 참고 이전)에 '/ait ' 참조 필요 (umbrella §1.3 규칙 3)`,
          ),
        );
      }
    }
  }

  return violations;
}

// ---------------------------------------------------------------------------
// A3 — 템플릿 + eval 동기화
// ---------------------------------------------------------------------------

/**
 * 파일 내용에서 {{token}} 패턴을 추출한다.
 * 알파벳/숫자/언더스코어로만 구성된 key 만 추출 (JSX 객체 리터럴 제외).
 * @param {string} content
 * @returns {Set<string>}
 */
function extractTokens(content) {
  const tokens = new Set();
  const re = /\{\{([a-zA-Z_][a-zA-Z0-9_]*)\}\}/g;
  for (const m of content.matchAll(re)) {
    tokens.add(m[1]);
  }
  return tokens;
}

/**
 * 디렉토리를 재귀적으로 순회하며 파일 경로를 yield한다.
 * @param {string} dir
 * @returns {Iterable<string>}
 */
function* walkFiles(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walkFiles(full);
    } else {
      yield full;
    }
  }
}

/** @param {string} root @returns {Violation[]} */
function checkA3(root) {
  const violations = [];

  // 1. 템플릿 검증
  const templatesDir = path.join(root, 'shared', 'templates');
  const templateNames = listDirs(templatesDir);

  for (const tplName of templateNames) {
    const tplDir = path.join(templatesDir, tplName);
    const tplJsonPath = path.join(tplDir, 'template.json');
    const relJson = path.relative(root, tplJsonPath);

    if (!fs.existsSync(tplJsonPath)) {
      violations.push(mkv(relJson, 1, 'A3/template-no-json', 'template.json 없음'));
      continue;
    }

    /** @type {{ tokens?: Record<string,unknown>, substitute?: { files?: string[] } }} */
    let tplMeta;
    try {
      tplMeta = JSON.parse(readFile(tplJsonPath));
    } catch {
      violations.push(mkv(relJson, 1, 'A3/template-json-invalid', 'template.json 파싱 실패'));
      continue;
    }

    const declaredTokens = new Set(Object.keys(tplMeta.tokens ?? {}));
    const substituteFiles = tplMeta.substitute?.files ?? [];

    // substitute.files 에 있는 파일에서 실제 토큰 수집
    const foundTokensInSubFiles = new Set();
    for (const subFile of substituteFiles) {
      const subFilePath = path.join(tplDir, subFile);
      if (!fs.existsSync(subFilePath)) {
        violations.push(
          mkv(
            relJson,
            1,
            'A3/substitute-file-missing',
            `substitute.files 의 '${subFile}' 이 템플릿 디렉터리에 없음 — template.json 갱신 또는 파일 복원`,
          ),
        );
        continue;
      }
      const content = readFile(subFilePath);
      for (const tok of extractTokens(content)) {
        foundTokensInSubFiles.add(tok);
      }
    }

    // 모든 파일 순회: substitute.files 밖 파일 + tsx/jsx 토큰 검출
    for (const filePath of walkFiles(tplDir)) {
      if (filePath === tplJsonPath) continue;
      const relToTpl = path.relative(tplDir, filePath);
      const isSubFile = substituteFiles.includes(relToTpl);
      const isTsx = filePath.endsWith('.tsx') || filePath.endsWith('.jsx');
      const content = readFile(filePath);
      const tokens = extractTokens(content);

      if (tokens.size === 0) continue;

      if (isTsx) {
        const relFull = path.relative(root, filePath);
        for (const tok of tokens) {
          violations.push(
            mkv(
              relFull,
              1,
              'A3/token-in-tsx',
              `{{${tok}}} 토큰이 .tsx/.jsx 파일에 있음 — JSX 파싱 오류 유발 (fix: 토큰 제거)`,
            ),
          );
        }
      } else if (!isSubFile) {
        const relFull = path.relative(root, filePath);
        for (const tok of tokens) {
          violations.push(
            mkv(
              relFull,
              1,
              'A3/token-outside-substitute-files',
              `{{${tok}}} 토큰이 substitute.files 밖 파일에 있음 (fix: template.json substitute.files 에 '${relToTpl}' 추가 또는 토큰 제거)`,
            ),
          );
        }
      }
    }

    // 선언된 토큰 vs 실제 사용 토큰 비교
    for (const declared of declaredTokens) {
      if (!foundTokensInSubFiles.has(declared)) {
        violations.push(
          mkv(
            relJson,
            1,
            'A3/token-declared-not-used',
            `토큰 '{{${declared}}}' 이 template.json tokens 에 선언됐지만 substitute.files 에서 발견 안 됨`,
          ),
        );
      }
    }
    for (const used of foundTokensInSubFiles) {
      if (!declaredTokens.has(used)) {
        violations.push(
          mkv(
            relJson,
            1,
            'A3/token-used-not-declared',
            `토큰 '{{${used}}}' 이 substitute.files 에서 사용되지만 template.json tokens 에 선언 안 됨`,
          ),
        );
      }
    }
  }

  // 2. promptfoo eval 동기화
  const promptfooConfig = path.join(root, 'eval', 'promptfoo', 'promptfooconfig.yaml');
  const relPromptfoo = path.relative(root, promptfooConfig);

  if (!fs.existsSync(promptfooConfig)) {
    violations.push(mkv(relPromptfoo, 1, 'A3/promptfoo-missing', 'promptfooconfig.yaml 없음'));
  } else {
    const yamlSrc = readFile(promptfooConfig);

    // providers.*.skills 블록에서 skill 목록 파싱
    const configSkills = new Set();
    const skillsBlockMatch = yamlSrc.match(/\bskills:\s*\n((?:[ \t]+-[ \t]+\S+\n?)+)/);
    if (skillsBlockMatch) {
      for (const m of skillsBlockMatch[1].matchAll(/^[ \t]+-[ \t]+(\S+)/gm)) {
        configSkills.add(m[1]);
      }
    }

    const diskSkills = new Set(listDirs(path.join(root, 'shared', 'skills')));

    for (const s of configSkills) {
      if (!diskSkills.has(s)) {
        violations.push(
          mkv(
            relPromptfoo,
            1,
            'A3/promptfoo-skill-unknown',
            `promptfooconfig.yaml에 '${s}' 가 있지만 shared/skills/ 에 없음`,
          ),
        );
      }
    }
    for (const s of diskSkills) {
      if (!configSkills.has(s)) {
        violations.push(
          mkv(
            relPromptfoo,
            1,
            'A3/promptfoo-skill-missing',
            `shared/skills/ 의 '${s}' 가 promptfooconfig.yaml skills 목록에 없음 (fix: skills 블록에 '- ${s}' 추가)`,
          ),
        );
      }
    }
  }

  return violations;
}

// ---------------------------------------------------------------------------
// A4 — CLI 토큰 크로스체크 (optional warn)
// ---------------------------------------------------------------------------

/** @param {string} root @returns {Violation[]} */
function checkA4(root) {
  const candidates = [path.join(root, '..', 'console-cli')];

  let consoleCLIRoot = null;
  for (const c of candidates) {
    if (fs.existsSync(c)) {
      consoleCLIRoot = c;
      break;
    }
  }

  if (!consoleCLIRoot) {
    return [
      mkv('', 0, 'A4/skipped', '../console-cli 를 찾을 수 없어 A4 건너뜀 (CI에서는 정상)', 'warn'),
    ];
  }

  const violations = [];

  // console-cli 명령 surface 추출 (citty defineCommand 패턴)
  // console-cli 의 실제 구조: export const fooCommand = defineCommand({ meta: { name: 'foo' }, ... })
  // cli.ts 의 top-level subCommands 에 등록된 이름(key)이 실제 aitcc <subcmd> surface 다.
  // 여기서는 meta.name 을 src/commands/*.ts 에서 수집해 Set 을 채운다.
  const cmdSrcDir = path.join(consoleCLIRoot, 'src', 'commands');
  /** @type {Set<string>} */
  const aitccSubcmds = new Set();
  if (fs.existsSync(cmdSrcDir)) {
    // citty pattern: meta: { ... name: 'foo' ... }
    const cittyMetaNameRe = /meta:\s*\{[^}]*name:\s*['"]([a-zA-Z0-9_-]+)['"]/gs;
    for (const entry of fs.readdirSync(cmdSrcDir, { withFileTypes: true })) {
      if (!entry.isFile()) continue;
      if (!entry.name.endsWith('.ts') && !entry.name.endsWith('.js')) continue;
      if (entry.name.includes('.test.')) continue;
      const content = readFile(path.join(cmdSrcDir, entry.name));
      for (const m of content.matchAll(cittyMetaNameRe)) {
        aitccSubcmds.add(m[1]);
      }
    }
  }

  // SKILL.md 파일에서 CLI 혼동 패턴 + 알 수 없는 aitcc 서브커맨드 검출
  // "현재 미구현" 문맥 또는 frontmatter `aitcc-surface-skip: true` 가 있으면 억제
  const skillsDir = path.join(root, 'shared', 'skills');
  // aitcc <subcmd> 토큰에서 제외할 known-deferred/intentional 서브커맨드
  // (console-cli 에 없지만 skill 에서 안내 목적으로 언급되는 것들)
  const AITCC_SUBCMD_SKIP = new Set(['logs']);
  for (const skillName of listDirs(skillsDir)) {
    const skillFile = path.join(skillsDir, skillName, 'SKILL.md');
    if (!fs.existsSync(skillFile)) continue;
    const relFile = path.relative(root, skillFile);
    const src = readFile(skillFile);
    const parsed = parseFrontmatter(src);
    // frontmatter 의 aitcc-surface-skip: true 가 있으면 unknown subcmd 경고 전체 억제
    const skipSurfaceCheck = parsed?.fm?.['aitcc-surface-skip'] === 'true';
    const lines = src.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // `aitcc app deploy <...>.ait` 패턴: .ait 파일 업로드는 ait (번들러 CLI)
      if (/aitcc\s+app\s+deploy\s+\S+\.ait/.test(line)) {
        violations.push(
          mkv(
            relFile,
            i + 1,
            'A4/aitcc-deploy-ait-path',
            `'aitcc app deploy <path>.ait' — .ait 파일 업로드는 'ait deploy' (번들러 CLI) 가 담당 (fix: 역할 구분 명확화)`,
            'warn',
          ),
        );
      }
      // aitcc app deploy --request-review 에 --release-notes 누락
      if (
        /aitcc\s+app\s+deploy\s+.*--request-review/.test(line) &&
        !line.includes('--release-notes')
      ) {
        violations.push(
          mkv(
            relFile,
            i + 1,
            'A4/deploy-missing-release-notes',
            `'aitcc app deploy --request-review' 에 --release-notes 누락 가능성 (fix: 확인 후 추가)`,
            'warn',
          ),
        );
      }

      // aitcc <subcmd> 토큰 크로스체크: console-cli 에 없는 서브커맨드 경고
      if (!skipSurfaceCheck && aitccSubcmds.size > 0) {
        const subcmdMatch = line.match(/\baitcc\s+([a-zA-Z][a-zA-Z0-9_-]*)\b/);
        if (subcmdMatch) {
          const subcmd = subcmdMatch[1];
          // CLI 자체가 아니라 단어 "CLI" 등 제외; skip-list 및 already-known 도 제외
          if (
            !AITCC_SUBCMD_SKIP.has(subcmd) &&
            !aitccSubcmds.has(subcmd) &&
            subcmd !== 'CLI' &&
            subcmd !== 'app' // app 은 subCommand 로 등록된 명령이지만 meta.name 은 subcommand 에 있을 수 있음
          ) {
            // "app" 은 cli.ts subCommands 키로 등록되지만 app.ts 내부 meta.name 은 다름
            // → aitccSubcmds Set 에 없어도 cli.ts 의 키 목록에 있으면 허용
            // cli.ts 를 직접 파싱하지 않으므로 hardcode 로 보완
            const CLI_TOP_LEVEL = new Set([
              'whoami',
              'login',
              'logout',
              'auth',
              'upgrade',
              'workspace',
              'app',
              'members',
              'keys',
              'notices',
              'me',
              'completion',
            ]);
            if (!CLI_TOP_LEVEL.has(subcmd)) {
              violations.push(
                mkv(
                  relFile,
                  i + 1,
                  'A4/aitcc-unknown-subcmd',
                  `'aitcc ${subcmd}' — console-cli 에서 확인되지 않은 서브커맨드 (fix: 명령 확인 또는 frontmatter 에 'aitcc-surface-skip: true' 추가)`,
                  'warn',
                ),
              );
            }
          }
        }
      }
    }
  }

  return violations;
}

// ---------------------------------------------------------------------------
// A5 — plugin.json ↔ package.json 버전 드리프트
// ---------------------------------------------------------------------------

/** @param {string} root @returns {Violation[]} */
function checkA5(root) {
  const pkgPath = path.join(root, 'package.json');
  const pluginPath = path.join(root, '.claude-plugin', 'plugin.json');
  const relPlugin = path.relative(root, pluginPath);

  /** @type {{ version?: string }} */
  let pkg;
  try {
    pkg = JSON.parse(readFile(pkgPath));
  } catch {
    return [mkv('package.json', 1, 'A5/plugin-json-version-drift', 'package.json 파싱 실패')];
  }

  /** @type {{ version?: string }} */
  let plugin;
  try {
    plugin = JSON.parse(readFile(pluginPath));
  } catch {
    return [
      mkv(relPlugin, 1, 'A5/plugin-json-version-drift', '.claude-plugin/plugin.json 파싱 실패'),
    ];
  }

  if (pkg.version !== plugin.version) {
    return [
      mkv(
        relPlugin,
        1,
        'A5/plugin-json-version-drift',
        `버전 불일치: .claude-plugin/plugin.json '${plugin.version}' vs package.json '${pkg.version}' (fix: pnpm sync:plugin-version 실행 또는 두 파일 직접 동기화)`,
      ),
    ];
  }

  return [];
}

// ---------------------------------------------------------------------------
// A6 — 링크 liveness (opt-in, warn-only, 네트워크)
// ---------------------------------------------------------------------------
//
// 기본은 SKIP — 네트워크 비의존·결정적 CI 경로를 보존한다(A4 graceful-skip 동형).
// VALIDATE_LINKS=1 일 때만 실행해 skill 전반의 *.aitc.dev 링크가 실제로
// 200을 반환하는지 검사한다. 절대 error 로 올리지 않는다 — 외부 호스트라
// 비결정적이고, 어디까지나 수동 link-sweep 자동화(advisory)다.
// (#183 docs /intro 404, #185 외부 링크 rot 가 A2 정적 검사를 빠져나간 갭을 닫는다.)

// 추출했지만 검사에서 제외하는 링크 패턴 (확인된 false-positive — #181·#185 triage):
//   - placeholder/template 토큰(<...>) 포함 링크
//   - oidc-bridge.aitc.dev bare-root: tenant dispatcher 라 루트 404 가 정상 동작
const A6_SKIP_LINK_RES = [
  /[<>]/, // <tenantId>, <resolved-path> 등 placeholder
  /^https:\/\/oidc-bridge\.aitc\.dev\/?$/, // bare-root = tenant dispatcher 정상 404
];

/**
 * skills 전반에서 *.aitc.dev 링크를 파일:행과 함께 추출한다.
 * @param {string} root
 * @returns {{ url: string, file: string, line: number }[]}
 */
function collectAitcLinks(root) {
  const skillsDir = path.join(root, 'shared', 'skills');
  /** @type {{ url: string, file: string, line: number }[]} */
  const out = [];
  const linkRe = /https:\/\/[a-z0-9.-]*aitc\.dev[a-zA-Z0-9./_-]*/g;
  for (const skillName of listDirs(skillsDir)) {
    const skillFile = path.join(skillsDir, skillName, 'SKILL.md');
    if (!fs.existsSync(skillFile)) continue;
    const relFile = path.relative(root, skillFile);
    const lines = readFile(skillFile).split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      for (const m of line.matchAll(linkRe)) {
        const url = m[0].replace(/[.,)]+$/, ''); // 문장부호 trailing 제거
        // URL 바로 뒤가 placeholder 토큰(<...>)이면 잘린 prefix 라 검사 제외.
        // (linkRe 가 '<' 에서 멈추므로 https://.../t/<tenantId> 가 '.../t/' 로 캡처됨)
        const after = line.slice(m.index + m[0].length);
        if (after.startsWith('<')) continue;
        if (A6_SKIP_LINK_RES.some((re) => re.test(url))) continue;
        out.push({ url, file: relFile, line: i + 1 });
      }
    }
  }
  return out;
}

/**
 * 단일 URL liveness 확인. HEAD 우선, 405/501 등엔 GET fallback.
 * @param {string} url
 * @returns {Promise<{ ok: boolean, status: number | string }>}
 */
async function probeUrl(url) {
  const tryFetch = async (method) => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12000);
    try {
      const res = await fetch(url, {
        method,
        redirect: 'follow',
        signal: ctrl.signal,
      });
      return res.status;
    } finally {
      clearTimeout(timer);
    }
  };
  try {
    let status = await tryFetch('HEAD');
    // 일부 호스트는 HEAD 미지원 → GET 재시도
    if (status === 405 || status === 501 || status === 403) {
      status = await tryFetch('GET');
    }
    return { ok: status >= 200 && status < 400, status };
  } catch (err) {
    return { ok: false, status: err instanceof Error ? err.name : 'fetch-error' };
  }
}

/**
 * @param {string} root
 * @returns {Promise<Violation[]>}
 */
async function checkA6(root) {
  if (process.env.VALIDATE_LINKS !== '1') {
    return [
      mkv(
        '',
        0,
        'A6/skipped',
        'VALIDATE_LINKS=1 이 아니라 링크 liveness 검사 건너뜀 (기본 동작)',
        'warn',
      ),
    ];
  }

  const links = collectAitcLinks(root);
  // 같은 URL 중복 제거하되 첫 등장 위치 보존
  /** @type {Map<string, { file: string, line: number }>} */
  const unique = new Map();
  for (const l of links) {
    if (!unique.has(l.url)) unique.set(l.url, { file: l.file, line: l.line });
  }

  const entries = [...unique.entries()];
  const results = await Promise.all(
    entries.map(async ([url, loc]) => ({ url, loc, ...(await probeUrl(url)) })),
  );

  /** @type {Violation[]} */
  const violations = [];
  for (const r of results) {
    if (!r.ok) {
      violations.push(
        mkv(
          r.loc.file,
          r.loc.line,
          'A6/dead-link',
          `링크 비정상 응답 (${r.status}): ${r.url} (fix: 살아있는 경로로 교체하거나 placeholder 면 A6_SKIP_LINK_RES 에 추가)`,
          'warn',
        ),
      );
    }
  }
  if (violations.length === 0) {
    violations.push(
      mkv(
        '',
        0,
        'A6/ok',
        `링크 liveness 통과 (${unique.size}개 *.aitc.dev 링크 전부 2xx/3xx)`,
        'warn',
      ),
    );
  }
  return violations;
}

// ---------------------------------------------------------------------------
// 메인 실행 함수 (export)
// ---------------------------------------------------------------------------

/**
 * @param {string} [repoRoot] repo 루트 경로 (기본값: 이 스크립트 기준 상위)
 * @returns {{ violations: Violation[], hasErrors: boolean }}
 */
export function runChecks(repoRoot) {
  const root = repoRoot ?? path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

  const allViolations = [
    ...checkA1(root),
    ...checkA2(root),
    ...checkA3(root),
    ...checkA4(root),
    ...checkA5(root),
  ];

  const hasErrors = allViolations.some((viol) => viol.level === 'error');
  return { violations: allViolations, hasErrors };
}

/**
 * 위반 사항을 규칙 그룹별로 콘솔에 출력한다.
 * @param {Violation[]} violations
 */
function printViolations(violations) {
  if (violations.length === 0) {
    console.log('모든 검사를 통과했습니다.');
    return;
  }

  /** @type {Map<string, Violation[]>} */
  const groups = new Map();
  for (const viol of violations) {
    const prefix = viol.rule.split('/')[0];
    if (!groups.has(prefix)) groups.set(prefix, []);
    groups.get(prefix).push(viol);
  }

  const groupLabels = {
    A1: 'A1 — frontmatter + 1:1 매핑 + 라우팅 스냅샷',
    A2: 'A2 — 본문 구조 + seam',
    A3: 'A3 — 템플릿 + eval 동기화',
    A4: 'A4 — CLI 토큰 크로스체크 (warn)',
    A5: 'A5 — plugin.json ↔ package.json 버전 드리프트',
    A6: 'A6 — 링크 liveness (opt-in, warn)',
  };

  for (const [prefix, items] of groups) {
    console.log(`\n${groupLabels[prefix] ?? prefix}`);
    console.log('-'.repeat(70));
    for (const item of items) {
      const loc = item.file ? `${item.file}:${item.line}` : '(전역)';
      const tag = item.level === 'warn' ? '[warn] ' : '[error]';
      console.log(`  ${loc.padEnd(58)} ${tag}  [${item.rule}]  ${item.message}`);
    }
  }

  const errors = violations.filter((viol) => viol.level === 'error');
  const warns = violations.filter((viol) => viol.level === 'warn');
  console.log(`\n요약: ${errors.length} error, ${warns.length} warn`);
}

// ---------------------------------------------------------------------------
// CLI 진입점
// ---------------------------------------------------------------------------

const isMain =
  process.argv[1] !== undefined &&
  (import.meta.url === `file://${process.argv[1]}` ||
    process.argv[1].endsWith('validate-plugin.mjs'));

if (isMain) {
  const { violations, hasErrors } = runChecks();
  // A6 (링크 liveness)는 opt-in async 검사 — CLI 진입점에서만 실행한다.
  // 기본은 VALIDATE_LINKS!=1 이라 즉시 skip warn 을 반환하고, runChecks 의
  // 동기 계약(vitest wrapper 가 의존)은 건드리지 않는다.
  const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
  const a6 = await checkA6(root);
  const all = [...violations, ...a6];
  printViolations(all);
  if (hasErrors) process.exit(1);
}
