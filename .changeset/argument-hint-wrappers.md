---
"@ait-co/agent-plugin": patch
---

Add `argument-hint` frontmatter to the 11 `/ait *` command wrappers that were missing it (only `ait-docs` and `ait-new` had it). Each wrapper now mirrors its SKILL.md hint — argument-less commands carry an explicit `argument-hint: ''` per the skill-uniformity rule, so the agent shows a consistent hint for every command.
