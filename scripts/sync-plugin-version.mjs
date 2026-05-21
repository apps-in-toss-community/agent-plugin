#!/usr/bin/env node
// Copies the package.json version into .claude-plugin/plugin.json so the
// plugin manifest never drifts behind a Changesets release. Run by the
// release workflow right after `changeset version`.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pkgPath = join(root, 'package.json');
const manifestPath = join(root, '.claude-plugin', 'plugin.json');

const { version } = JSON.parse(readFileSync(pkgPath, 'utf8'));
const raw = readFileSync(manifestPath, 'utf8');
const manifest = JSON.parse(raw);

if (manifest.version === version) {
  process.exit(0);
}

manifest.version = version;
const trailingNewline = raw.endsWith('\n') ? '\n' : '';
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}${trailingNewline}`);
console.log(`synced .claude-plugin/plugin.json version → ${version}`);
