---
'@ait-co/agent-plugin': patch
---

chore: pnpm 10.33.0 → 11.17.0 + `allowBuilds` 전환 (템플릿·스킬 포함)

- `package.json`의 `packageManager`를 `pnpm@11.17.0`으로 올리고, 저장소 루트에
  `pnpm-workspace.yaml`(`allowBuilds: { esbuild: true }`)을 추가했다. pnpm 11은
  `onlyBuiltDependencies` / `ignoredBuiltDependencies`를 제거하고 `allowBuilds`
  맵으로 대체했는데, 선언되지 않은 install script는 이제 경고가 아니라
  `pnpm install`을 exit 1로 죽이는 `ERR_PNPM_IGNORED_BUILDS` 하드 실패다.
- `shared/templates/react-vite/`(scaffold 템플릿)도 같은 이유로
  `pnpm-workspace.yaml`(`@sentry/cli`·`@swc/core`·`cloudflared`·`protobufjs`는
  `false`, `esbuild`만 `true`)을 추가하고 `packageManager`를 맞춰 올렸다 — 이
  파일 없이 pin만 올렸다면 `/ait new`로 갓 생성한 프로젝트가 첫
  `pnpm install`에서 바로 실패했을 것이다(측정: `@sentry/cli`, `@swc/core`,
  `cloudflared`, `esbuild`, `protobufjs`에 대한 `ERR_PNPM_IGNORED_BUILDS`).
- `setup-phone-preview` skill이 `pnpm-workspace.yaml`의 `onlyBuiltDependencies`에
  `cloudflared`를 추가하라고 안내하던 부분을 `allowBuilds`의
  `cloudflared: true`로 재작성했다 — 옛 키는 pnpm 11에서 완전히 무시된다.
- `allowBuilds`는 pnpm 10.33 이상에서도 읽히므로 두 변경 모두 pnpm 10에
  남아있는 프로젝트에도 안전하다.
