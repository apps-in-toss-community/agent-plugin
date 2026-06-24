// eval/e2e — 리포트 (토큰→USD 재계산 + KPI 3종 요약)
// ------------------------------------------------------------------
// USD는 1차 저장값이 아니다(plan §1.1). runs.jsonl 의 토큰을 pricing.json 으로
// 리포트 시점에 재계산한다 — 가격이 바뀌면 pricing.json만 고쳐 과거를 다시 돈다.

import { coefficientOfVariation, median, quantile, wilsonInterval } from './stats.ts';
import type { ModelUsageEntry, Pricing, RunRecord } from './types.ts';

/** 한 run의 총 토큰 (in+out+cache, 모든 모델 합산). */
export function totalTokens(usage: Record<string, ModelUsageEntry>): number {
  let sum = 0;
  for (const u of Object.values(usage)) {
    sum += u.inputTokens + u.outputTokens + u.cacheReadInputTokens + u.cacheCreationInputTokens;
  }
  return sum;
}

/** pricing.json 에서 모델 단가를 찾는다 (정확 일치 우선, 없으면 prefix 매칭). */
function rateFor(model: string, pricing: Pricing) {
  if (pricing.models[model]) return pricing.models[model];
  const key = Object.keys(pricing.models).find((k) => model.startsWith(k) || k.startsWith(model));
  return key ? pricing.models[key] : null;
}

/** 토큰 → USD 재계산. 단가 미상 모델은 0(리포트에서 별도 경고). */
export function recomputeUsd(usage: Record<string, ModelUsageEntry>, pricing: Pricing): number {
  let usd = 0;
  for (const [model, u] of Object.entries(usage)) {
    const rate = rateFor(model, pricing);
    if (!rate) continue;
    usd +=
      (u.inputTokens / 1e6) * rate.inputPerMtok +
      (u.outputTokens / 1e6) * rate.outputPerMtok +
      (u.cacheReadInputTokens / 1e6) * rate.cacheReadPerMtok +
      (u.cacheCreationInputTokens / 1e6) * rate.cacheWritePerMtok;
  }
  return usd;
}

export interface CellSummary {
  taskId: string;
  model: string;
  n: number;
  successes: number;
  // KPI 1: 완주율 + Wilson CI
  completion: { rate: number; low: number; high: number };
  // KPI 2: 성공당 토큰 (중앙값 + IQR)
  tokensPerSuccess: { median: number; p25: number; p75: number } | null;
  // KPI 3: run-to-run 분산 (토큰 CV — 전체 run 기준)
  tokenCv: number;
  // 파생 USD (pricing.json 재계산)
  usd: { medianPerSuccess: number | null; totalAll: number };
  // 진단
  stations: Record<string, number>;
  failClasses: Record<string, number>;
}

export function summarizeCell(
  runs: RunRecord[],
  taskId: string,
  model: string,
  pricing: Pricing,
): CellSummary {
  const cell = runs.filter((r) => r.taskId === taskId && r.model === model);
  const n = cell.length;
  const successes = cell.filter((r) => r.success).length;
  const completion = wilsonInterval(successes, n);

  const allTokens = cell.map((r) => totalTokens(r.modelUsage));
  const successTokens = cell.filter((r) => r.success).map((r) => totalTokens(r.modelUsage));

  const tokensPerSuccess =
    successTokens.length > 0
      ? {
          median: median(successTokens),
          p25: quantile(successTokens, 0.25),
          p75: quantile(successTokens, 0.75),
        }
      : null;

  const successUsd = cell.filter((r) => r.success).map((r) => recomputeUsd(r.modelUsage, pricing));
  const totalUsd = cell.reduce((a, r) => a + recomputeUsd(r.modelUsage, pricing), 0);

  const stations: Record<string, number> = {};
  const failClasses: Record<string, number> = {};
  for (const r of cell) {
    stations[r.station] = (stations[r.station] ?? 0) + 1;
    if (r.failClass) failClasses[r.failClass] = (failClasses[r.failClass] ?? 0) + 1;
  }

  return {
    taskId,
    model,
    n,
    successes,
    completion,
    tokensPerSuccess,
    tokenCv: coefficientOfVariation(allTokens),
    usd: { medianPerSuccess: successUsd.length ? median(successUsd) : null, totalAll: totalUsd },
    stations,
    failClasses,
  };
}

function pct(x: number): string {
  return Number.isNaN(x) ? '—' : `${(x * 100).toFixed(0)}%`;
}
function num(x: number | null | undefined): string {
  return x == null || Number.isNaN(x) ? '—' : Math.round(x).toLocaleString('en-US');
}
function usd(x: number | null | undefined): string {
  return x == null || Number.isNaN(x) ? '—' : `$${x.toFixed(4)}`;
}

/** 사람이 읽는 KPI 요약 (stdout). */
export function formatSummary(s: CellSummary): string {
  const lines: string[] = [];
  lines.push(`── ${s.taskId} × ${s.model}  (n=${s.n})`);
  lines.push(
    `   완주율        ${pct(s.completion.rate)}  ` +
      `[95% CI ${pct(s.completion.low)}–${pct(s.completion.high)}]  (${s.successes}/${s.n})`,
  );
  if (s.tokensPerSuccess) {
    lines.push(
      `   성공당 토큰   median ${num(s.tokensPerSuccess.median)}  ` +
        `[IQR ${num(s.tokensPerSuccess.p25)}–${num(s.tokensPerSuccess.p75)}]`,
    );
  } else {
    lines.push(`   성공당 토큰   — (성공 run 없음)`);
  }
  lines.push(
    `   토큰 CV       ${Number.isNaN(s.tokenCv) ? '—' : s.tokenCv.toFixed(3)}  (run-to-run 분산)`,
  );
  lines.push(`   USD/완주      ${usd(s.usd.medianPerSuccess)}  (pricing.json 재계산, 참고)`);
  const stationStr = Object.entries(s.stations)
    .map(([k, v]) => `${k}:${v}`)
    .join(' ');
  lines.push(`   도달 분포     ${stationStr || '—'}`);
  const failStr = Object.entries(s.failClasses)
    .map(([k, v]) => `${k}:${v}`)
    .join(' ');
  if (failStr) lines.push(`   실패 분류     ${failStr}`);
  return lines.join('\n');
}
