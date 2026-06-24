// eval/e2e — 공유 타입

/** 도달한 coarse station (산출물 폴링으로 판정). */
export type Station = 'none' | 'scaffold' | 'install' | 'dev-able' | 'bundle';

/** 실패 분류 (결정적 — exit code + 파일 존재 + 신호). */
export type FailClass =
  | 'toolchain' // Node/pnpm 부재 등 환경
  | 'scaffold' // 프로젝트 파일이 안 만들어짐
  | 'install' // 의존성 설치 실패 (node_modules 없음)
  | 'build' // bundle:ait / ait build 실패 (.ait 없음)
  | 'timeout' // maxTurns 초과
  | 'agent-gaveup' // 에이전트가 완주 전 정상 종료(success) but 산출물 미달
  | 'dispatch-missing' // /ait 명령이 세션에 로드 안 됨 (init assert 실패)
  | 'driver-error'; // SDK/심링크/예외

/** committed task 정의 (tasks/*.task.json). */
export interface Task {
  id: string;
  /** `/ait new <appName>` 에 넘길 이름. */
  appName: string;
  /** 에이전트에 주입할 "작은 아이디어" 발화 (verbatim). */
  prompt: string;
  /** 결정적 채점 기준. */
  expect: {
    /** scaffold 후 존재해야 하는 (프로젝트-상대 또는 cwd-상대) 경로. */
    scaffold: string[];
    /** package.json dependencies에 있어야 하는 패키지. */
    dep: string;
    /** setup-bundle 후 존재해야 하는 경로. */
    bundle: string[];
  };
  /** 종착점. P1은 build-only만. */
  endpoint: 'build-only';
}

/** SDK ModelUsage 와 동형 (per-model 토큰). */
export interface ModelUsageEntry {
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens: number;
  cacheCreationInputTokens: number;
  costUSD: number;
}

/** runs.jsonl 의 한 줄. */
export interface RunRecord {
  ts: number;
  taskId: string;
  model: string;
  iteration: number;
  success: boolean;
  station: Station;
  failClass: FailClass | null;
  modelUsage: Record<string, ModelUsageEntry>;
  /** SDK 추정 USD — 참고용. KPI 산식엔 안 들어감 (pricing.json 재계산이 정본). */
  totalCostUsd: number;
  turns: number;
  wallMs: number;
  resultSubtype: string;
  /** --log-init 일 때만 채워짐. */
  initSlashCommands?: string[];
  /** driver-error 일 때만. */
  error?: string;
}

/** pricing.json — tier별 per-MTok 단가 (토큰→USD 재계산). */
export interface Pricing {
  /** 가격표 갱신 날짜 (ISO, 메인테이너 기록). */
  asOf: string;
  /** model id(또는 prefix) → 단가. */
  models: Record<
    string,
    {
      inputPerMtok: number;
      outputPerMtok: number;
      cacheReadPerMtok: number;
      cacheWritePerMtok: number;
    }
  >;
}
