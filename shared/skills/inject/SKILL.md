---
name: inject
description: |
  Patch an existing Apps in Toss mini-app's build setup. Two facets:
  `/ait inject-devtools` adds the `@ait-co/devtools` unplugin for browser dev
  ("기존 Vite 프로젝트에 devtools 붙여줘"); `/ait inject-polyfill` wires
  `@ait-co/polyfill` so standard Web API calls route to the SDK ("표준 Web API로
  마이그레이션해줘"). Idempotent, minimal edits.
argument-hint: '[--entry <path>]'
---

# inject skill

이 skill은 두 facet을 담는다 — `/ait inject-devtools`(devtools unplugin 주입)와 `/ait inject-polyfill`(polyfill 모드 마이그레이션). 둘 다 기존 프로젝트의 빌드 셋업을 최소 변경으로 패치하는 brownfield station 2 도구라 하나로 묶였다(issue #273). 사용자가 어느 command로 진입했는지에 따라 아래 해당 facet으로 분기한다 — 두 facet은 독립이며 서로를 자동 실행하지 않는다.

## 목적

이미 `@apps-in-toss/web-framework`를 쓰는 기존 미니앱 프로젝트의 개발 환경을 확장한다.
`new-miniapp`이 greenfield(빈 디렉토리)라면 이 skill은 **brownfield** — 기존 파일을 최소한으로
수정하고, 이미 설정이 있으면 skip한다. 어느 facet이든 생성·수정하는 파일에서 "공식(official)",
"토스가 제공하는", "powered by Toss" 등 제휴·후원·인증 암시 표현을 쓰지 않는다.

두 facet은 목적이 다르다:

- **devtools facet** (`/ait inject-devtools`): `@ait-co/devtools` unplugin을 빌드 config에
  추가해 토스 앱 없이 브라우저에서 mock SDK로 개발·테스트한다. 인자 없음.
- **polyfill facet** (`/ait inject-polyfill`): `@ait-co/polyfill`을 도입해 앱 코드가 표준 Web
  API(`navigator.clipboard` 등)를 그대로 써도 런타임에 SDK로 라우팅되게 한다. `--entry <path>`
  로 진입점을 지정할 수 있다(기본값 자동 감지).

## devtools facet — `/ait inject-devtools`

빌드 도구(Vite / Next.js / Rspack / Webpack)를 감지하고, lockfile로 패키지 매니저를 감지해
`@ait-co/devtools`를 devDep으로 설치한 뒤, config 파일을 멱등하게 패치한다
(`aitDevtools.<bundler>({ panel: true })`). 이미 설정이 있으면 skip. 콘솔 인증 불필요 — 로컬
dev 전용이다.

핵심 절차: (1) `package.json` 확인 → (2) 빌드 도구 감지 → (3) PM 감지 → (4) idempotency
확인 → (5) devDep 설치 → (6) 번들러별 config 패치(Vite `optimizeDeps.exclude` 포함) →
(7) 완료 seam. 번들러별 정확한 패치 패턴·경고 처리·하지 말아야 할 것은 —

**상세가 필요하면 Read `<이 skill의 base directory>/references/devtools.md`.**

## polyfill facet — `/ait inject-polyfill`

`@ait-co/polyfill`을 **runtime dependency**로 설치하고, 진입점 맨 첫 줄에
`import '@ait-co/polyfill/auto'`를 멱등하게 삽입한 뒤, Tier-1 SDK 직접 호출 코드를 표준 Web
API로 자동 변환한다(Grep+Edit). Tier-1 외 API(IAP·Auth·Payments)는 대응이 없어 수동 유지한다.

핵심 절차: (1) `package.json` + 기존 설치 확인 → (2) PM 감지 후 runtime dep 설치 →
(3) 진입점 감지(`--entry` 또는 자동) → (4) `/auto` import 멱등 삽입 → (5) README 단락(있으면)
→ (6) Tier-1 자동 변환 → (7) 완료 seam. 지원 API 표·`/auto` vs `install()` 선택·변환 매핑·
하지 말아야 할 것은 —

**상세가 필요하면 Read `<이 skill의 base directory>/references/polyfill.md`.**

## 다음 단계 (facet별 seam)

**devtools facet** 완료 후:

```
@ait-co/devtools 설정 완료 · <config-file> 패치

다음 단계:
  pnpm dev                  # 브라우저에서 앱 실행 (하단에 AIT DevTools 패널)
  /ait debug                # 브라우저 패널·window.__ait 상태로 디버깅
  /ait setup-phone-preview  # (선택) 실기기에서 dev 앱 미리보기
```

**polyfill facet** 완료 후:

```
@ait-co/polyfill 설정 완료 · <진입점>에 /auto import 삽입

다음 단계:
  pnpm dev              # 표준 API 경로가 동작하는지 브라우저에서 확인
  /ait inject-devtools  # (권장) devtools와 함께 쓰면 브라우저에서도 mock SDK 경유 확인
  /ait setup-bundle     # 배포 준비가 되면 .ait 번들 환경 구성
```

각 facet의 완전한 완료 블록(변경 요약·주의사항 포함)은 위 references 파일에 있다.

## Out of scope (이 skill이 하지 않는 것)

- ❌ 새 프로젝트 생성 (greenfield) — `/ait new` (`new-miniapp` skill).
- ❌ 콘솔 인증·배포 — `/ait deploy` (`deploy` skill).
- ❌ `.ait` 번들 빌드 환경 설정 — `/ait setup-bundle`.
- ❌ (devtools) panel 마운트 E2E 검증 — 사용자가 직접 `pnpm dev`로 확인.
- ❌ (devtools) Rollup/esbuild 라이브러리 빌드에 mock 주입 — 앱(미니앱) 전용.
- ❌ (polyfill) Tier-1 외 API 자동 변환 / `@apps-in-toss/web-framework` 제거.

## 참고

- 커뮤니티 docs — 표준 Web API → SDK 라우팅 shim과 dev 환경 셋업(브라우저 mock·실기기 미리보기): https://docs.aitc.dev/guides/dev-environment
- devtools facet 상세: `<이 skill의 base directory>/references/devtools.md`
- polyfill facet 상세: `<이 skill의 base directory>/references/polyfill.md`
- 짝 skill: `new-miniapp` (새 프로젝트 생성 — devtools/polyfill 포함 템플릿), `debug` (devtools facet이 깔아둔 panel·CDP relay를 소비하는 on-device 디버깅), `setup-phone-preview` (실기기 WebKit 미리보기 병행), `deploy` (설정 완료 후 콘솔 배포).
- `@ait-co/devtools`: https://github.com/apps-in-toss-community/devtools · live demo: https://devtools.aitc.dev/
- `@ait-co/polyfill`: https://github.com/apps-in-toss-community/polyfill · 통합 가이드: [`polyfill/INTEGRATION.md`](https://github.com/apps-in-toss-community/polyfill/blob/main/INTEGRATION.md)
