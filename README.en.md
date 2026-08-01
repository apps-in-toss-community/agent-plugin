# agent-plugin

[한국어](./README.md) · **English**

Community plugin for building [Apps in Toss](https://toss.im/) mini-apps from inside coding agents — currently supports [Claude Code](https://claude.com/claude-code). Codex and other agents are planned for later phases.

This project is no longer maintained. The repo is being archived and becomes read-only; the source and issue history stay on GitHub. This plugin ships as the Git repo itself rather than an npm package, so `/plugin marketplace add apps-in-toss-community/agent-plugin` keeps working after the archive, but it will not be updated. The `aitc.dev` domain and the sites served on it are being shut down, so the documentation links now point at GitHub sources — the community docs links printed by the skills resolve to source files in [`apps-in-toss-community/docs`](https://github.com/apps-in-toss-community/docs).

Two parts of this repo depended on that domain. Environment 2 (real-device PWA preview), which `/ait:setup-phone-preview` and `/ait:debug` walk you through, has its entry point — the launcher PWA — hosted at `https://devtools.aitc.dev/launcher/`, and the tunnel QR / deep-link is built against that address; there is no replacement host. The shared oidc-bridge instance (`oidc-bridge.aitc.dev`) that `/ait:auth-setup` used as its default is also going away, leaving self-hosting the [`oidc-bridge`](https://github.com/apps-in-toss-community/oidc-bridge) source as the remaining path. Launchers already installed on a phone cannot be updated retroactively.

## Goal

Ties together `@ait-co/devtools`, `sdk-example`, `@ait-co/polyfill`, and the community docs into a single integrated experience. Slash commands available today:

- `/ait:new` — scaffold a new mini-app
- `/ait:docs <topic>` — load curated SDK docs into the session
- `/ait:inject-devtools` / `/ait:inject-polyfill` / `/ait:inject-debug-console` — inject config into an existing project
- `/ait:status` / `/ait:logs` — console-cli-backed status queries
- `/ait:auth-setup` — configure oidc-bridge connection
- `/ait:debug` — browser debugging guidance (devtools panel · `window.__ait` · browser DevTools). On-device CDP debugging of phone bundles is in progress
- `/ait:deploy` — deploy the mini-app

See the "Skills" table in [`CLAUDE.md`](./CLAUDE.md) for the full skill list and dependency repos.

## Distribution

A **dual-distribution** model from a single repo to multiple AI coding agent marketplaces (following the [Figma `mcp-server-guide`](https://github.com/figma/mcp-server-guide) pattern).

```
agent-plugin/
├── shared/                  # source of truth (skills, commands, templates)
│   ├── skills/              # SKILL.md bundles
│   ├── commands/            # slash command entry points (thin wrappers)
│   └── templates/           # scaffolding templates
├── .claude-plugin/          # Claude Code plugin + marketplace manifest (Phase 1, current)
└── .codex-plugin/           # Codex (Phase 3, after spec is finalised)
```

`shared/` is the source of truth. Real logic lives in skills; slash commands are thin wrappers. See [`CLAUDE.md`](./CLAUDE.md) for architecture and decision background.

### Install

In Claude Code, add the marketplace and install the plugin:

```bash
/plugin marketplace add apps-in-toss-community/agent-plugin
/plugin install ait@aitc
```

After installation the `/ait:` commands (`/ait:new`, `/ait:deploy`, etc.) become available. The plugin name is the namespace, so the colon form is the real command — a space form (`/ait new`) does not exist.

Codex / Gemini CLI / Cursor / Windsurf are planned for Phase 2+. See the deployment-phases section in [`CLAUDE.md`](./CLAUDE.md).

## Development

### Pre-commit hook

Optional but recommended. After cloning, activate the standard pre-commit hook (runs `biome check` on staged files):

```sh
git config core.hooksPath .githooks
```

This is a developer convenience for fast feedback before push. CI runs the same checks as the enforcement layer, so contributors who don't activate the hook will still see lint failures in their PR.

## Status

Related repos live on the [organization's GitHub](https://github.com/apps-in-toss-community).

---

Community open-source project.
