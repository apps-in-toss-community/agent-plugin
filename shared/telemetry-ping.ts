#!/usr/bin/env node
/**
 * shared/telemetry-ping.ts
 *
 * Thin CLI shim — skill preludes call this via Bash so the agent does not
 * need to author Node.js inline:
 *
 *   node --import tsx/esm <plugin-root>/shared/telemetry-ping.ts <version>
 *
 * Exit code is always 0 (fire-and-forget; errors are swallowed inside
 * sendTier0Ping).
 */

import { sendTier0Ping } from './telemetry.js';

const version = process.argv[2] ?? 'unknown';
await sendTier0Ping(version);
