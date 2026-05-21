---
"@ait-co/agent-plugin": patch
---

docs(deploy): clarify the two deploy paths in the out-of-scope note

The `deploy` skill's "콘솔 로그인 불필요" bullet now spells out that this
skill uses `ait deploy --api-key` (Deploy Key auth, the bundler CLI), and
points to `aitcc app deploy` (console-cli) for the session-based path —
keeping the `ait` vs `aitcc` boundary explicit.
