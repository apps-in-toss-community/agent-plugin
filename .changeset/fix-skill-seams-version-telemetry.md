---
"@ait-co/agent-plugin": patch
---

fix: correct skill seams, plugin.json version, and TELEMETRY path

- `new-miniapp` skill: step-6 seam now routes `setup-bundle → register → deploy` instead of jumping straight to `deploy`
- `setup-bundle` skill: step-9 completion block now routes `register → deploy` instead of jumping straight to `deploy`
- `plugin.json`: version synced to 0.1.8 (was stuck at 0.1.6, matching package.json and CHANGELOG)
- `TELEMETRY.md`: `$(dirname "$0")/../../..` corrected to `../..` — command files are two levels below plugin root (`shared/commands/ait-*.md`), not three
