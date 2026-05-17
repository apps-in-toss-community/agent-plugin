# agent-plugin

[한국어](./README.md) · **English**

> 🚧 **Work in Progress** — not yet published.

Community plugin for building [Apps in Toss](https://toss.im/) mini-apps from inside coding agents — supports both **[Claude Code](https://claude.com/claude-code)** and **[OpenAI Codex CLI](https://developers.openai.com/codex)**.

## Goal

Ties together `@ait-co/devtools`, `sdk-example`, `@ait-co/polyfill`, and the community docs into a single integrated experience. Currently scaffolded slash commands (some are stubs):

- `/ait new` — scaffold a new mini-app _(stub)_
- `/ait docs <topic>` — load curated SDK docs into the session _(working — docs repo content still being written)_
- `/ait inject-devtools` / `/ait inject-polyfill` — inject config into an existing project _(stub)_
- `/ait debug` — analyse browser state (when devtools MCP is present) _(stub)_
- `/ait deploy` / `/ait logs` / `/ait status` — console-cli-backed operations _(stub)_
- `/ait auth-setup` — configure oidc-bridge connection _(stub)_

See the "Skills" table in [`CLAUDE.md`](./CLAUDE.md) for the full skill list and dependency repos.

## Distribution

A **dual-distribution** model from a single repo to multiple AI coding agent marketplaces (following the [Figma `mcp-server-guide`](https://github.com/figma/mcp-server-guide) pattern).

```
agent-plugin/
├── shared/                  # source of truth (skills, commands, templates)
│   ├── skills/              # SKILL.md bundles
│   ├── commands/            # slash command entry points (thin wrappers)
│   └── templates/           # scaffolding templates
├── .claude-plugin/          # Claude Code plugin manifest (Phase 1, current)
└── .codex-plugin/           # Codex (Phase 3, after spec is finalised)
```

`shared/` is the source of truth. Real logic lives in skills; slash commands are thin wrappers. See [`CLAUDE.md`](./CLAUDE.md) for architecture and decision background.

### Install

```bash
# Claude Code (Phase 1 — manifest exists, marketplace registration pending)
/plugin marketplace add apps-in-toss-community/agent-plugin
```

Codex / Gemini CLI / Cursor / Windsurf are planned for Phase 2+. See "배포 phases" in [`CLAUDE.md`](./CLAUDE.md).

## Development

### Pre-commit hook

Optional but recommended. After cloning, activate the standard pre-commit hook (runs `biome check` on staged files):

```sh
git config core.hooksPath .githooks
```

This is a developer convenience for fast feedback before push. CI runs the same checks as the enforcement layer, so contributors who don't activate the hook will still see lint failures in their PR.

## Status

See the [organization landing page](https://aitc.dev/) for the full roadmap.

---

Community open-source project.
