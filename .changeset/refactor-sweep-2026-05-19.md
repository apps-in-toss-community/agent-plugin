---
"@ait-co/agent-plugin": patch
---

refactor: sync plugin.json version, fix stale Codex claim, rename ait-console → aitcc, correct stub markers

- `.claude-plugin/plugin.json` version synced to 0.1.6 (was stuck at 0.1.0)
- README ko/en: clarify Claude Code is current target; Codex is a later phase (was "supports both Claude Code and Codex")
- `package.json` description updated to match
- `ait-console` references replaced with `aitcc` in CLAUDE.md, deploy skill, and deploy command description
- `(stub)` markers removed from `ait-inject-devtools`, `ait-auth-setup`, `ait-logs` commands — skills were implemented in 0.1.3
- CLAUDE.md Status section updated to reflect implemented vs. still-stub skills
- README skill list reordered: working commands listed first, remaining stubs (deploy, debug) at the bottom with blocking reason
