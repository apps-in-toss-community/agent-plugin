---
'@ait-co/agent-plugin': patch
---

Implement the Tier 1 skill-event POST in `sendTier1Event`. It now sends `{tier:1, source, event, anon_id, version, ts, meta?}` to the telemetry endpoint when effective consent is granted under the current policy, honoring the global `AITC_TELEMETRY` opt-out and the same fire-and-forget 5 s timeout as the Tier 0 ping. The metrics-ingest server already allowlists the `skill_invoked` event for this source.
