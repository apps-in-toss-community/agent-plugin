/**
 * shared/telemetry.test.ts
 *
 * Isolated unit tests for:
 *   - State file read / write (atomic, permissions)
 *   - Daily dedupe logic
 *   - Opt-out mechanisms (env var, tier0OptOut flag)
 *   - resolveEffectiveConsent policy-version staleness check
 */

import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ─── helpers ───────────────────────────────────────────────────────────────

/** Creates an isolated temp dir and points XDG_CONFIG_HOME at it. */
function makeSandbox(): string {
  const dir = join(
    tmpdir(),
    `ait-telemetry-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  mkdirSync(dir, { recursive: true });
  process.env.XDG_CONFIG_HOME = dir;
  return dir;
}

function cleanSandbox(dir: string): void {
  delete process.env.XDG_CONFIG_HOME;
  if (existsSync(dir)) {
    rmSync(dir, { recursive: true, force: true });
  }
}

// ─── tests ─────────────────────────────────────────────────────────────────

describe('telemetry-state', () => {
  let sandbox = '';

  beforeEach(() => {
    sandbox = makeSandbox();
    // Ensure env opt-out is clear between tests.
    delete process.env.AITC_TELEMETRY;
  });

  afterEach(() => {
    cleanSandbox(sandbox);
    delete process.env.AITC_TELEMETRY;
    vi.restoreAllMocks();
  });

  it('returns a valid default state when no file exists', async () => {
    const { readState, CURRENT_POLICY_VERSION } = await import('./telemetry-state.js');
    const state = readState();
    expect(state.consent).toBe('undecided');
    expect(state.policyVersion).toBe(CURRENT_POLICY_VERSION);
    expect(state.anonId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(state.tier0LastSent).toBeUndefined();
  });

  it('round-trips state through writeState/readState', async () => {
    const { readState, writeState, CURRENT_POLICY_VERSION } = await import('./telemetry-state.js');
    const initial = readState();
    const updated = { ...initial, tier0LastSent: '2026-05-18', consent: 'granted' as const };
    await writeState(updated);

    const retrieved = readState();
    expect(retrieved.tier0LastSent).toBe('2026-05-18');
    expect(retrieved.consent).toBe('granted');
    expect(retrieved.policyVersion).toBe(CURRENT_POLICY_VERSION);
  });

  it('falls back to default on corrupt JSON', async () => {
    // Write garbage into the state file location.
    const { readState } = await import('./telemetry-state.js');
    const { writeFileSync } = await import('node:fs');
    const stateDir = join(sandbox, 'aitc-agent-plugin');
    mkdirSync(stateDir, { recursive: true });
    writeFileSync(join(stateDir, 'telemetry.json'), 'not json {{{', 'utf8');

    const state = readState();
    expect(state.consent).toBe('undecided');
  });

  it('resolveEffectiveConsent returns undecided when policy version is stale', async () => {
    const { resolveEffectiveConsent } = await import('./telemetry-state.js');
    const staleState = {
      anonId: '00000000-0000-4000-8000-000000000000',
      consent: 'granted' as const,
      policyVersion: '2025-01-01', // old version
    };
    expect(resolveEffectiveConsent(staleState)).toBe('undecided');
  });

  it('resolveEffectiveConsent keeps granted when policy version matches', async () => {
    const { resolveEffectiveConsent, CURRENT_POLICY_VERSION } = await import(
      './telemetry-state.js'
    );
    const freshState = {
      anonId: '00000000-0000-4000-8000-000000000000',
      consent: 'granted' as const,
      policyVersion: CURRENT_POLICY_VERSION,
    };
    expect(resolveEffectiveConsent(freshState)).toBe('granted');
  });

  it('resolveEffectiveConsent keeps denied across policy version bump', async () => {
    const { resolveEffectiveConsent } = await import('./telemetry-state.js');
    const deniedState = {
      anonId: '00000000-0000-4000-8000-000000000000',
      consent: 'denied' as const,
      policyVersion: '2020-01-01',
    };
    expect(resolveEffectiveConsent(deniedState)).toBe('denied');
  });

  it('todayUtc returns a YYYY-MM-DD string', async () => {
    const { todayUtc } = await import('./telemetry-state.js');
    expect(todayUtc()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('sendTier0Ping', () => {
  let sandbox = '';

  beforeEach(() => {
    sandbox = makeSandbox();
    delete process.env.AITC_TELEMETRY;
    vi.resetModules();
  });

  afterEach(() => {
    cleanSandbox(sandbox);
    delete process.env.AITC_TELEMETRY;
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('skips when AITC_TELEMETRY=off', async () => {
    process.env.AITC_TELEMETRY = 'off';
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const { sendTier0Ping } = await import('./telemetry.js');
    await sendTier0Ping('0.1.5');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('skips when tier0OptOut is true in state file', async () => {
    const { writeState } = await import('./telemetry-state.js');
    await writeState({
      anonId: '00000000-0000-4000-8000-000000000001',
      consent: 'undecided',
      policyVersion: '2026-05-18',
      tier0OptOut: true,
    });

    vi.resetModules();
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const { sendTier0Ping } = await import('./telemetry.js');
    await sendTier0Ping('0.1.5');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('skips when tier0LastSent is today', async () => {
    const { writeState, todayUtc } = await import('./telemetry-state.js');
    await writeState({
      anonId: '00000000-0000-4000-8000-000000000002',
      consent: 'undecided',
      policyVersion: '2026-05-18',
      tier0LastSent: todayUtc(),
    });

    vi.resetModules();
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const { sendTier0Ping } = await import('./telemetry.js');
    await sendTier0Ping('0.1.5');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('sends ping and updates tier0LastSent on success', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null, { status: 200 }));

    const { sendTier0Ping } = await import('./telemetry.js');
    await sendTier0Ping('0.1.5');

    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/e');
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body.tier).toBe(0);
    expect(body.source).toBe('agent-plugin');
    expect(body.version).toBe('0.1.5');

    vi.resetModules();
    const { readState, todayUtc } = await import('./telemetry-state.js');
    const state = readState();
    expect(state.tier0LastSent).toBe(todayUtc());
  });

  it('does not update tier0LastSent when server returns 5xx', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 500 }));

    const { sendTier0Ping } = await import('./telemetry.js');
    await sendTier0Ping('0.1.5');

    vi.resetModules();
    const { readState } = await import('./telemetry-state.js');
    const state = readState();
    expect(state.tier0LastSent).toBeUndefined();
  });

  it('does not throw when fetch rejects (network error)', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network unreachable'));

    const { sendTier0Ping } = await import('./telemetry.js');
    await expect(sendTier0Ping('0.1.5')).resolves.toBeUndefined();
  });
});

describe('sendTier1Event (stub)', () => {
  let sandbox = '';

  beforeEach(() => {
    sandbox = makeSandbox();
    vi.resetModules();
  });

  afterEach(() => {
    cleanSandbox(sandbox);
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('is a no-op when consent is undecided', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const { sendTier1Event } = await import('./telemetry.js');
    await sendTier1Event('skill_invoked', '0.1.5', { skill: 'new-miniapp' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('is a no-op when consent is denied', async () => {
    const { writeState } = await import('./telemetry-state.js');
    await writeState({
      anonId: '00000000-0000-4000-8000-000000000003',
      consent: 'denied',
      policyVersion: '2026-05-18',
    });

    vi.resetModules();
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const { sendTier1Event } = await import('./telemetry.js');
    await sendTier1Event('skill_invoked', '0.1.5', { skill: 'new-miniapp' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('is a no-op even when consent is granted (stub — follow-up)', async () => {
    const { writeState } = await import('./telemetry-state.js');
    await writeState({
      anonId: '00000000-0000-4000-8000-000000000004',
      consent: 'granted',
      policyVersion: '2026-05-18',
    });

    vi.resetModules();
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const { sendTier1Event } = await import('./telemetry.js');
    await sendTier1Event('skill_invoked', '0.1.5', { skill: 'docs' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
