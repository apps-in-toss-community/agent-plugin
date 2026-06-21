/**
 * validate-plugin.mjs
 *
 * 구조 검증기 — shared/{skills,commands,templates} + eval/ 의 정합성을 확인.
 * 4개 그룹으로 나뉜다:
 *   A1 — frontmatter + 1:1 매핑 (hard-fail)
 *   A2 — 본문 구조 (hard-fail)
 *   A3 — 템플릿 + eval 동기화 (hard-fail)
 *   A4 — CLI 토큰 크로스체크 (optional warn, ../console-cli 없으면 skip)
 *
 * CLI: node scripts/validate-plugin.mjs
 * API: import { runChecks } from './scripts/validate-plugin.mjs'
 *      const { violations } = await runChecks(repoRoot)
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

  return violations;
}

// ---------------------------------------------------------------------------
// A2 — 본문 구조
// ---------------------------------------------------------------------------

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
      if (!fs.existsSync(subFilePath)) continue;
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

  // console-cli 명령 surface 추출
  const cmdSrcDir = path.join(consoleCLIRoot, 'src', 'commands');
  const aitccSubcmds = new Set();
  if (fs.existsSync(cmdSrcDir)) {
    /** @param {string} dir */
    function collectCmds(dir) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.isDirectory()) {
          collectCmds(path.join(dir, entry.name));
        } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.js')) {
          const content = readFile(path.join(dir, entry.name));
          for (const m of content.matchAll(/\.command\(['"]([a-zA-Z0-9_-]+)/g)) {
            aitccSubcmds.add(m[1]);
          }
        }
      }
    }
    collectCmds(cmdSrcDir);
  }

  // SKILL.md 파일에서 CLI 혼동 패턴 검출
  const skillsDir = path.join(root, 'shared', 'skills');
  for (const skillName of listDirs(skillsDir)) {
    const skillFile = path.join(skillsDir, skillName, 'SKILL.md');
    if (!fs.existsSync(skillFile)) continue;
    const relFile = path.relative(root, skillFile);
    const src = readFile(skillFile);
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
    }
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

  const allViolations = [...checkA1(root), ...checkA2(root), ...checkA3(root), ...checkA4(root)];

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
    A1: 'A1 — frontmatter + 1:1 매핑',
    A2: 'A2 — 본문 구조',
    A3: 'A3 — 템플릿 + eval 동기화',
    A4: 'A4 — CLI 토큰 크로스체크 (warn)',
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
  printViolations(violations);
  if (hasErrors) process.exit(1);
}
