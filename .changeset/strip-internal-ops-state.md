---
"@ait-co/agent-plugin": patch
---

fix: strip internal ops state and defensive labels from shipped skills

- `status` skill: replace the real dog-food app/workspace identifiers in the summary example with generic placeholders, and rewrite the ops note that referenced specific internal miniApp IDs / REVIEW-lock codes into a generic "focus on the current project" guideline.
- `auth-setup` skill: drop the internal miniApp ID from the live-validation note and replace the `비공식` label with the calm community open-source identity.
- `inject-devtools` / `new-miniapp` skills: replace remaining `비공식 커뮤니티` labels (forbidden by the tone guide) with `커뮤니티 오픈소스`.
- `README.en.md`: refer to the deployment-phases section by English description instead of quoting the Korean heading verbatim.
