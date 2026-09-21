/** Pinned JEV version. Do not switch to jev-latest — thresholds are tuned to this. */
export const JEV_MODEL = "jev-1.13.0";

export const JEV_ENDPOINT = "https://api.typesafe.ai/v1/systemone";

/** How many JEV calls to run at once. */
export const JEV_CONCURRENCY = 6;

/** Milliseconds to wait for one JEV call before giving up. */
export const JEV_TIMEOUT_MS = 3000;

/** How much block text we send to JEV. */
export const BLOCK_TEXT_CHAR_LIMIT = 2000;

/** Hide when any enabled rule's noul is at least this. */
export const DEFAULT_THRESHOLD = 0.8;

/** Cap candidates per page scan. */
export const MAX_BLOCKS_PER_PAGE = 40;

export type NoulQuestion = {
  type: "noul";
  instructions: string;
  criteria: {
    true: string;
    false: string;
  };
};

export type JevState = {
  url: string;
  page_title: string;
  text: string;
};

export type JevAnswerBody = {
  model?: string;
  answers?: Record<string, { type?: string; noul?: number; score?: number }>;
};

export type JudgeResult =
  | { ok: true; scores: Record<string, number>; model: string }
  | { ok: false; reason: string; retryAfterMs?: number };

export type HideRule = {
  id: string;
  label: string;
  enabled: boolean;
  preset?: "ads" | "political" | "negative";
  instructions: string;
  criteria: {
    true: string;
    false: string;
  };
};

export type ExtensionSettings = {
  apiKey: string;
  enabled: boolean;
  paused: boolean;
  threshold: number;
  rules: HideRule[];
  siteAllowlist: string[];
  siteDenylist: string[];
};

export type ExtractedBlock = {
  id: string;
  text: string;
  tagName: string;
};

export type HideDecision = {
  hide: boolean;
  matchedRuleId?: string;
  matchedRuleLabel?: string;
  noul?: number;
  scores?: Record<string, number>;
};

export type BlockJudgment = HideDecision & {
  blockId: string;
  reason?: string;
};
