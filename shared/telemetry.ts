/**
 * shared/telemetry.ts
 *
 * Shared telemetry helpers for agent-plugin.
 *
 * Tier 0 — opt-out daily ping:
 *   Sends {source, version, platform} once per day. No PII. No anon_id
 *   is sent by the client; the server generates a daily ephemeral hash from
 *   IP+UA+date. Enabled by default; disabled by AITC_TELEMETRY=off or
 *   tier0OptOut: true in the state file.
 *
 * Tier 1 — opt-in skill event stream (stub — wiring in follow-up PR):
 *   sendTier1Event is present for import compatibility but is a no-op until
 *   Tier 1 consent prompt + server-side schema are finalized.
 *
 * Privacy: https://docs.aitc.dev/privacy
 */

import { CURRENT_POLICY_VERSION, readState, todayUtc, writeState } from './telemetry-state.js';

export const TELEMETRY_CONFIG = {
  endpoint:
    process.env.AITC_TELEMETRY_ENV === 'staging'
      ? 'https://t-staging.aitc.dev/e'
      : 'https://t.aitc.dev/e',
  source: 'agent-plugin',
  policyVersion: CURRENT_POLICY_VERSION,
} as const;

/** First-run notice printed once via the install-marker in the state file. */
export const FIRST_RUN_NOTICE =
  '익명 사용 신호(버전·플랫폼만)는 자동 수집됩니다. ' +
  '비활성화: AITC_TELEMETRY=off 환경변수 설정. ' +
  '상세 정책: https://docs.aitc.dev/privacy';

/**
 * Sends a Tier 0 daily ping.
 *
 * - Fire-and-forget: call with `void sendTier0Ping(version)` or
 *   `await sendTier0Ping(version)` (5 s timeout makes it safe to await).
 * - Skips silently on any error (network unreachable, 4xx, 5xx).
 * - Deduped: at most one successful ping per UTC day.
 */
export async function sendTier0Ping(version: string): Promise<void> {
  // Global opt-out via environment variable.
  const envFlag = process.env.AITC_TELEMETRY;
  if (envFlag === 'off' || envFlag === '0' || envFlag === 'false') {
    return;
  }

  let state = readState();

  // Per-state opt-out flag.
  if (state.tier0OptOut === true) {
    return;
  }

  // Daily dedupe — skip if we already sent today.
  const today = todayUtc();
  if (state.tier0LastSent === today) {
    return;
  }

  // Print first-run notice once if this is the first ever state write.
  const isFirstRun = state.tier0LastSent === undefined;

  const payload = {
    tier: 0,
    source: TELEMETRY_CONFIG.source,
    version,
    platform: process.platform,
    policy_version: TELEMETRY_CONFIG.policyVersion,
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5_000);

  try {
    const res = await fetch(TELEMETRY_CONFIG.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    // Only mark as sent on success (2xx).
    if (res.ok) {
      state = { ...state, tier0LastSent: today };
      await writeState(state);

      if (isFirstRun) {
        // Use process.stderr to avoid polluting skill stdout.
        process.stderr.write(`[aitc] ${FIRST_RUN_NOTICE}\n`);
      }
    }
  } catch {
    // Network error, timeout, or write failure — silent skip.
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Sends a Tier 1 skill event.
 *
 * STUB — Tier 1 consent prompt and server-side schema are follow-up work.
 * This function is present so call sites can be wired now; it is a no-op
 * until the follow-up PR activates it.
 */
export async function sendTier1Event(
  event: 'skill_invoked',
  version: string,
  meta?: Record<string, unknown>,
): Promise<void> {
  // Validate consent before doing anything.
  const state = readState();
  if (state.consent !== 'granted') {
    return;
  }

  // TODO(follow-up): implement POST to /e with tier:1, anon_id, event, meta.
  void event;
  void version;
  void meta;
}
