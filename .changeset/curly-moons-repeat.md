---
'@ait-co/agent-plugin': patch
---

스캐폴드 템플릿과 `setup-phone-preview` skill이 `@ait-co/devtools@0.2.0`을 가리키도록 갱신한다 (devtools#818 — 3-패키지 분리).

0.x에서 caret은 minor를 잠그므로 `^0.1.x` 참조는 0.2.0을 받지 못한다. 그대로 두면 `/ait:new`로 만든 새 프로젝트가 분리 전 devtools(구 debug 표면이 들어 있는 버전)에 영구 고정되고 station 1(scaffold) → 2(dev) seam이 조용히 끊긴다.

- `shared/templates/react-vite/package.json`: `^0.1.103` → `^0.2.0`
- `shared/skills/setup-phone-preview/SKILL.md`: 의존 하한·업그레이드 명령을 `^0.2.0`으로 옮기고, caret이 minor를 잠근다는 사실과 0.2.0 분리 영향(`in-app`·`mcp/*` 직접 import는 전환 스텁이 된다)을 안내에 포함
- `eval/e2e/baseline.json`: 템플릿을 미러하는 `fixedInputs.templateBaseline` 값 동반 이동 (`asOf: null`, kpi 슬롯 전부 null이라 무효화할 측정치 없음)

템플릿은 `@ait-co/devtools/unplugin`의 `{ panel: true }`만 쓰므로 0.2.0에서 빠져나간 표면에 닿지 않는다 — drop-in이다. npm에 올라간 0.2.0 tarball로 이 템플릿을 실제 설치·빌드해 확인했다(resolved 0.2.0 / runtime deps 3개 / production 번들에 devtools sentinel 0건).
