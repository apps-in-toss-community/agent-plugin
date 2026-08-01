/**
 * driver.test.ts
 *
 * canUseTool 게이트의 결정적 핵심인 isForbiddenBashCommand 단위 테스트.
 *
 * 이 게이트가 build-only 측정 경로에서 콘솔/인증 변이(특히 register 자율 디스패치
 * = 새 앱 자동 생성 반-패턴, §1.4)를 구조적으로 막는다. 프롬프트 텍스트는 모델이
 * 무시할 수 있으므로 명령 문자열을 직접 검사하는 이 함수가 권위 있는 관문이다.
 *
 * 회귀 가드: 금지 명령(aitcc / ait deploy·register·login / --api-key)은 전부 차단,
 * 정상 build-only 명령(ait build / pnpm / git 등)은 전부 통과해야 한다.
 */

import { describe, expect, it } from 'vitest';
import { exposesKey, isForbiddenBashCommand } from './driver.ts';

describe('isForbiddenBashCommand', () => {
  // 차단돼야 하는 콘솔/인증 변이 명령.
  const FORBIDDEN = [
    'aitcc app register --config ./aitcc/aitcc.yaml',
    'aitcc app deploy bundle.ait --request-review --release-notes "x"',
    'aitcc keys create',
    'aitcc me terms agree --yes',
    'npx aitcc app status',
    'ait deploy --profile dogfood',
    'ait deploy --scheme-only',
    'ait register',
    'ait login',
    'ait deploy --api-key SOMETOKEN',
    'pnpm exec ait deploy --api-key "$AITCC_API_KEY" --scheme-only',
    'echo x && aitcc app deploy bundle.ait', // 체이닝 우회 시도
  ];

  // 통과해야 하는 build-only / 일반 개발 명령.
  const ALLOWED = [
    'ait build',
    'pnpm bundle:ait',
    'RELEASE_CHANNEL=dogfood ait build',
    'pnpm install',
    'pnpm dev',
    'pnpm typecheck',
    'git init',
    'mkdir -p src',
    'node -v',
    'cat package.json',
    'pnpm add @ait-co/devtools', // 패키지 설치 — 콘솔 무접촉
  ];

  for (const cmd of FORBIDDEN) {
    it(`차단: ${cmd}`, () => {
      expect(isForbiddenBashCommand(cmd)).toBe(true);
    });
  }

  for (const cmd of ALLOWED) {
    it(`통과: ${cmd}`, () => {
      expect(isForbiddenBashCommand(cmd)).toBe(false);
    });
  }

  it('`ait build` 는 `ait deploy` 패턴에 오탐되지 않는다', () => {
    expect(isForbiddenBashCommand('ait build')).toBe(false);
  });

  it('빈 문자열은 통과(차단 대상 없음)', () => {
    expect(isForbiddenBashCommand('')).toBe(false);
  });
});

// init assert 의 키 매칭. slash-command 키는 command 파일의 basename 이고, 플러그인으로
// 얹히면 `ait:<basename>` 이 된다 — 2026-07-27 실측(#226). 설치 형상에서는 skill 도 같은
// `slash_commands` 목록에 `ait:<디렉토리 이름>` 으로 함께 오른다(#286 init dump 실측).
// `"ait new"` 같은 다단어 키는 어느 형상에도 존재하지 않는다.
//
// 아래 픽스처는 **현재 출하되는 표면**에서 뽑는다 — #286 을 닫은 #290 이 facet stub 6개를
// bare verb 로 개명해(`shared/commands/ait-new.md` → `new.md`) `ait-new` 는 어느 형상에도
// 없고, 드라이버가 실제로 디스패치하는 키는 `new`(= driver.ts `DISPATCH_COMMAND`)다.
//
// **이 픽스처는 개명 회귀를 잡지 않는다.** 아래 배열은 하드코딩 리터럴이고 이 파일은
// `shared/commands/` 를 읽지 않는다 — `new.md` 를 `ait-new.md` 로 되돌려도 이 테스트는
// 전부 통과한다. 픽스처를 현재 키로 맞추는 이유는 감지력이 아니라, 테스트가 더 이상
// 출하되지 않는 이름을 정본처럼 들고 있지 않게 하려는 것뿐이다.
//
// 실제 개명 가드는 `scripts/validate-plugin.mjs` 의 `A1/routing-mismatch` 다 —
// `EXPECTED_CMD_TO_SKILL` 이 `shared/commands/` basename 전수를 열거하고 실제 디렉토리와
// 양방향 대조하므로, 개명하면 "스냅샷에 있는데 파일 없음" + "파일 있는데 스냅샷에 없음"
// 두 건이 hard-fail 로 뜬다.
describe('exposesKey', () => {
  // project 형상(이 드라이버): `.claude/{commands,skills}` → `shared/{commands,skills}` symlink.
  const PROJECT_COMMANDS = ['changeset', 'ait-auth-setup', 'ait-setup-bundle', 'new', 'logs'];
  const PROJECT_SKILLS = ['new-miniapp', 'setup-bundle', 'plan'];
  // 설치 형상(`/plugin install`): 플러그인 이름이 네임스페이스.
  const PLUGIN_COMMANDS = ['ait:changeset', 'ait:ait-auth-setup', 'ait:new', 'ait:logs'];
  const PLUGIN_SKILLS = ['ait:new-miniapp', 'ait:setup-bundle', 'ait:plan'];

  it('project 형상의 basename 키를 찾는다', () => {
    expect(exposesKey(PROJECT_COMMANDS, 'new')).toBe(true);
    expect(exposesKey(PROJECT_COMMANDS, 'ait-setup-bundle')).toBe(true);
  });

  it('플러그인 형상의 <plugin>: 접두어 키도 같은 이름으로 찾는다', () => {
    expect(exposesKey(PLUGIN_COMMANDS, 'new')).toBe(true);
    expect(exposesKey(PLUGIN_SKILLS, 'new-miniapp')).toBe(true);
  });

  it('드라이버 init assert 의 두 키가 양쪽 형상에서 잡힌다 (`new` 명령 + `new-miniapp` skill)', () => {
    expect(exposesKey(PROJECT_COMMANDS, 'new') && exposesKey(PROJECT_SKILLS, 'new-miniapp')).toBe(
      true,
    );
    expect(exposesKey(PLUGIN_COMMANDS, 'new') && exposesKey(PLUGIN_SKILLS, 'new-miniapp')).toBe(
      true,
    );
  });

  it('bare stub 이 없는 2단계 verb 는 skill 이름으로 잡힌다 (`setup-bundle`)', () => {
    // `ait-setup-bundle.md` stub 은 `ait:ait-setup-bundle` 이라 문서 경로가 아니다.
    expect(exposesKey(PROJECT_COMMANDS, 'setup-bundle')).toBe(false);
    expect(exposesKey(PROJECT_SKILLS, 'setup-bundle')).toBe(true);
    expect(exposesKey(PLUGIN_SKILLS, 'setup-bundle')).toBe(true);
  });

  it('개명 전 basename `ait-new` 는 어느 형상에도 없다 (#286 → #290)', () => {
    expect(exposesKey(PROJECT_COMMANDS, 'ait-new')).toBe(false);
    expect(exposesKey(PLUGIN_COMMANDS, 'ait-new')).toBe(false);
  });

  it('존재하지 않는 다단어 표현은 못 찾는다 (공백 형태 `/ait new` 는 명령이 아니다)', () => {
    expect(exposesKey(PROJECT_COMMANDS, 'ait new')).toBe(false);
    expect(exposesKey(PLUGIN_COMMANDS, 'ait new')).toBe(false);
  });

  it('단일 prefix `ait` 로는 매칭되지 않는다 (부분 문자열 매칭 아님)', () => {
    expect(exposesKey(PROJECT_COMMANDS, 'ait')).toBe(false);
    expect(exposesKey(PLUGIN_COMMANDS, 'ait')).toBe(false);
  });

  it('접두어가 다른 유사 키를 오탐하지 않는다', () => {
    expect(exposesKey(['other:new'], 'new')).toBe(true);
    expect(exposesKey(['new-thing'], 'new')).toBe(false);
    expect(exposesKey(['xnew'], 'new')).toBe(false);
  });

  it('빈 목록이면 false', () => {
    expect(exposesKey([], 'new')).toBe(false);
  });
});
