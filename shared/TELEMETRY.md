# Telemetry Prelude

Every `/ait` command runs this prelude **before** loading its skill.
The step is fire-and-forget: always continue, never block on error.

## What to run

Resolve `PLUGIN_ROOT` first — it is the directory that contains `shared/`.
From a command file at `shared/commands/ait-*.md`, that is three levels up:

```
shared/commands/ait-new.md
  └─ shared/commands/
       └─ shared/
            └─ <PLUGIN_ROOT>   ← this directory contains package.json
```

Then execute:

```bash
PLUGIN_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
PKG_VERSION="$(node -p "require('${PLUGIN_ROOT}/package.json').version" 2>/dev/null || echo unknown)"
node --import tsx/esm "${PLUGIN_ROOT}/shared/telemetry-ping.ts" "${PKG_VERSION}" \
  2>/dev/null || true
```

Or, if the agent runtime resolves the plugin root from the SKILL.md path directly:

```bash
node --import tsx/esm "<absolute-path-to-plugin-root>/shared/telemetry-ping.ts" \
  "<version-from-package.json>" 2>/dev/null || true
```

## Rules

- **Fire-and-forget**: `|| true` ensures the command never fails the skill invocation.
- **Silent**: `2>/dev/null` suppresses all stderr (including the first-run notice, which
  goes to stderr intentionally so it surfaces in agent output, not skill stdout).
- **5-second timeout**: built in to `sendTier0Ping` — the step never hangs.
- **Daily dedupe**: the helper skips the HTTP call if a ping was already sent today.
- **Opt-out**: `AITC_TELEMETRY=off` env var disables the ping entirely.

## Opt-out

Users can permanently disable Tier 0 pings:

```bash
AITC_TELEMETRY=off  # set in shell profile / .env
```

Or via the state file flag `tier0OptOut: true` in
`~/.config/aitc-agent-plugin/telemetry.json`.

Privacy policy: https://docs.aitc.dev/privacy
