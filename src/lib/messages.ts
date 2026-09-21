import type { BlockJudgment, ExtractedBlock } from "./types";

export type JudgeBlocksMessage = {
  type: "JUDGE_BLOCKS";
  pageUrl: string;
  pageTitle: string;
  blocks: Pick<ExtractedBlock, "id" | "text">[];
};

export type GetStatusMessage = {
  type: "GET_STATUS";
  tabId?: number;
};

export type SetEnabledMessage = {
  type: "SET_ENABLED";
  enabled: boolean;
};

export type SetPausedMessage = {
  type: "SET_PAUSED";
  paused: boolean;
};

export type RescanMessage = {
  type: "RESCAN";
};

export type ReportStatsMessage = {
  type: "REPORT_STATS";
  scanned: number;
  hidden: number;
};

export type ExtensionMessage =
  | JudgeBlocksMessage
  | GetStatusMessage
  | SetEnabledMessage
  | SetPausedMessage
  | RescanMessage
  | ReportStatsMessage;

export type ScanStatus =
  | "idle"
  | "scanning"
  | "paused"
  | "disabled"
  | "missing_key"
  | "skipped"
  | "error";

export type StatusPayload = {
  enabled: boolean;
  paused: boolean;
  hasKey: boolean;
  threshold: number;
  scanned: number;
  hidden: number;
  status: ScanStatus;
  lastError?: string;
};

export type JudgeBlocksResponse = {
  ok: boolean;
  enabled: boolean;
  paused: boolean;
  judgments: BlockJudgment[];
  scanned: number;
  hidden: number;
  status: ScanStatus;
  reason?: string;
};
