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
import { isForbiddenBashCommand } from './driver.ts';

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
