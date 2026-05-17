/**
 * shared/telemetry-state.ts
 *
 * Persistent telemetry state for agent-plugin.
 * State file: $XDG_CONFIG_HOME/aitc-agent-plugin/telemetry.json
 *             (default: ~/.config/aitc-agent-plugin/telemetry.json)
 *
 * agent-plugin maintains its own state file, independent from console-cli's
 * ~/.config/aitcc/telemetry.json. Rationale:
 *   1. agent-plugin runs inside Claude Code / Codex — a different host process
 *      with its own filesystem permissions, not guaranteed to be co-located
 *      with console-cli.
 *   2. Policy versions for the two tools can evolve independently.
 *   3. Avoids cross-tool consent bleed (a user opting out of console-cli should
 *      not implicitly opt out of agent-plugin without a separate decision).
 */

import { createHash, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { chmod } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

export const CURRENT_POLICY_VERSION = '2026-05-18';

export interface TelemetryState {
  /** UUID v4 — persisted for Tier 1 events only. Tier 0 uses server-side hashing. */
  anonId: string;
  /** Tier 1 consent state. Does NOT affect Tier 0. */
  consent: 'undecided' | 'granted' | 'denied';
  /** Policy version at the time consent was last set. */
  policyVersion: string;
  /** ISO date (YYYY-MM-DD) of the last successful Tier 0 ping for daily dedupe. */
  tier0LastSent?: string;
  /** When true, Tier 0 pings are suppressed regardless of env var. */
  tier0OptOut?: boolean;
}

function getStateDir(): string {
  const xdgConfigHome = process.env.XDG_CONFIG_HOME;
  const base = xdgConfigHome ?? join(homedir(), '.config');
  return join(base, 'aitc-agent-plugin');
}

function getStatePath(): string {
  return join(getStateDir(), 'telemetry.json');
}

function defaultState(): TelemetryState {
  return {
    anonId: randomUUID(),
    consent: 'undecided',
    policyVersion: CURRENT_POLICY_VERSION,
  };
}

/**
 * Returns the effective consent: if consent was 'granted' for an older policy
 * version, it reverts to 'undecided' so the user sees the updated prompt.
 * Denied state is sticky across policy bumps (no reprompt).
 */
export function resolveEffectiveConsent(state: TelemetryState): 'undecided' | 'granted' | 'denied' {
  if (state.consent === 'granted' && state.policyVersion !== CURRENT_POLICY_VERSION) {
    return 'undecided';
  }
  return state.consent;
}

/** Reads and validates the state file, returning defaults if missing or corrupt. */
export function readState(): TelemetryState {
  const path = getStatePath();
  if (!existsSync(path)) {
    return defaultState();
  }
  try {
    const raw = readFileSync(path, 'utf8');
    const parsed: unknown = JSON.parse(raw);
    if (!isValidState(parsed)) {
      return defaultState();
    }
    return parsed;
  } catch {
    return defaultState();
  }
}

/** Atomically writes the state file (tmp + rename). Ensures 0700 dir, 0600 file. */
export async function writeState(state: TelemetryState): Promise<void> {
  const dir = getStateDir();
  const path = getStatePath();

  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true, mode: 0o700 });
  }

  const tmp = `${path}.tmp-${createHash('sha256').update(String(Date.now())).digest('hex').slice(0, 8)}`;
  writeFileSync(tmp, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
  await chmod(tmp, 0o600);
  renameSync(tmp, path);
}

function isValidState(v: unknown): v is TelemetryState {
  if (typeof v !== 'object' || v === null) return false;
  const obj = v as Record<string, unknown>;
  return (
    typeof obj.anonId === 'string' &&
    (obj.consent === 'undecided' || obj.consent === 'granted' || obj.consent === 'denied') &&
    typeof obj.policyVersion === 'string'
  );
}

/** Returns today's date as YYYY-MM-DD (UTC). */
export function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}
