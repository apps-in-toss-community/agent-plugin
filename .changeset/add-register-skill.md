---
"@ait-co/agent-plugin": patch
---

feat: add /ait register skill for non-interactive app registration

New `register` skill closes the harness gap between `/ait setup-bundle` and `/ait deploy`: it scaffolds the `aitcc.yaml` manifest non-interactively (the work the TTY-only `aitcc app init` does), discovers `workspaceId` / `categoryIds` via `aitcc whoami --json` and `aitcc app categories --selectable --json`, then runs `aitcc app register --json` (offers `--dry-run` first; `--accept-terms` only with explicit user consent). Never overwrites an existing manifest, uses the console session (not a Deploy Key), and never invokes interactive `aitcc login`.
