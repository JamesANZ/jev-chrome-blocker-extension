import { JudgmentCache, cacheKey } from "../lib/cache";
import { judgeBlock, mapWithConcurrency } from "../lib/jev-client";
import type {
  ExtensionMessage,
  JudgeBlocksResponse,
  StatusPayload,
} from "../lib/messages";
import { decideHide } from "../lib/policy";
import { compileRules, enabledRuleIds } from "../lib/rules";
import { loadSettings, saveSettings, sitePolicy } from "../lib/settings";
import {
  BLOCK_TEXT_CHAR_LIMIT,
  JEV_CONCURRENCY,
  JEV_MODEL,
  MAX_BLOCKS_PER_PAGE,
  type BlockJudgment,
  type JevState,
} from "../lib/types";

const cache = new JudgmentCache();
const tabStats = new Map<
  number,
  Pick<StatusPayload, "scanned" | "hidden" | "status" | "lastError">
>();
let cooldownUntil = 0;

function tabIdOf(
  sender: chrome.runtime.MessageSender,
  explicit?: number,
): number | undefined {
  return explicit ?? sender.tab?.id;
}

function rememberTab(
  tabId: number | undefined,
  stats: Pick<StatusPayload, "scanned" | "hidden" | "status" | "lastError">,
): void {
  if (tabId === undefined) return;
  tabStats.set(tabId, stats);
}

async function statusFor(tabId?: number): Promise<StatusPayload> {
  const settings = await loadSettings();
  const stats = tabId !== undefined ? tabStats.get(tabId) : undefined;
  let status: StatusPayload["status"] = stats?.status ?? "idle";
  if (!settings.apiKey) status = "missing_key";
  else if (!settings.enabled) status = "disabled";
  else if (settings.paused) status = "paused";
  return {
    enabled: settings.enabled,
    paused: settings.paused,
    hasKey: settings.apiKey.length > 0,
    threshold: settings.threshold,
    scanned: stats?.scanned ?? 0,
    hidden: stats?.hidden ?? 0,
    status,
    lastError: stats?.lastError,
  };
}

async function judgeBlocks(
  pageUrl: string,
  pageTitle: string,
  blocks: { id: string; text: string }[],
  tabId?: number,
): Promise<JudgeBlocksResponse> {
  const settings = await loadSettings();
  const empty = (
    status: JudgeBlocksResponse["status"],
    reason?: string,
  ): JudgeBlocksResponse => ({
    ok: status !== "error" && status !== "missing_key",
    enabled: settings.enabled,
    paused: settings.paused,
    judgments: [],
    scanned: 0,
    hidden: 0,
    status,
    reason,
  });

  if (!settings.apiKey) {
    const result = empty("missing_key", "missing_key");
    rememberTab(tabId, result);
    return result;
  }
  if (!settings.enabled) {
    const result = empty("disabled");
    rememberTab(tabId, result);
    return result;
  }
  if (settings.paused) {
    const result = empty("paused");
    rememberTab(tabId, result);
    return result;
  }

  let hostname = "";
  try {
    hostname = new URL(pageUrl).hostname;
  } catch {
    const result = empty("skipped", "bad_url");
    rememberTab(tabId, result);
    return result;
  }
  if (
    sitePolicy(hostname, settings.siteAllowlist, settings.siteDenylist) ===
    "skip"
  ) {
    const result = empty("skipped", "site_skipped");
    rememberTab(tabId, result);
    return result;
  }

  const questions = compileRules(settings.rules);
  const ruleIds = enabledRuleIds(settings.rules);
  const candidates = blocks.slice(0, MAX_BLOCKS_PER_PAGE);
  rememberTab(tabId, { scanned: 0, hidden: 0, status: "scanning" });

  if (ruleIds.length === 0) {
    const result: JudgeBlocksResponse = {
      ok: true,
      enabled: true,
      paused: false,
      judgments: candidates.map((block) => ({
        blockId: block.id,
        hide: false,
      })),
      scanned: candidates.length,
      hidden: 0,
      status: "idle",
    };
    rememberTab(tabId, result);
    return result;
  }

  const judgments = await mapWithConcurrency(
    candidates,
    JEV_CONCURRENCY,
    async (block): Promise<BlockJudgment> => {
      if (Date.now() < cooldownUntil) {
        return { blockId: block.id, hide: false, reason: "rate_limited" };
      }

      const key = cacheKey(block.text, ruleIds, JEV_MODEL);
      const cached = cache.get(key);
      if (cached) {
        return {
          blockId: block.id,
          ...decideHide(cached, settings.rules, settings.threshold),
        };
      }

      const state: JevState = {
        url: pageUrl,
        page_title: pageTitle,
        text: block.text.slice(0, BLOCK_TEXT_CHAR_LIMIT),
      };
      const judged = await judgeBlock(state, questions, () => settings.apiKey);
      if (!judged.ok) {
        if (judged.reason === "rate_limited") {
          cooldownUntil = Date.now() + (judged.retryAfterMs ?? 2000);
        }
        return { blockId: block.id, hide: false, reason: judged.reason };
      }
      cache.set(key, judged.scores);
      return {
        blockId: block.id,
        ...decideHide(judged.scores, settings.rules, settings.threshold),
      };
    },
  );

  const hidden = judgments.filter((item) => item.hide).length;
  const result: JudgeBlocksResponse = {
    ok: true,
    enabled: true,
    paused: false,
    judgments,
    scanned: judgments.length,
    hidden,
    status: "idle",
  };
  rememberTab(tabId, result);
  return result;
}

chrome.runtime.onMessage.addListener(
  (message: ExtensionMessage, sender, sendResponse) => {
    const tabId = tabIdOf(
      sender,
      "tabId" in message ? message.tabId : undefined,
    );

    if (message.type === "JUDGE_BLOCKS") {
      judgeBlocks(message.pageUrl, message.pageTitle, message.blocks, tabId)
        .then(sendResponse)
        .catch((error: unknown) => {
          const reason = error instanceof Error ? error.message : "error";
          rememberTab(tabId, {
            scanned: 0,
            hidden: 0,
            status: "error",
            lastError: reason,
          });
          sendResponse({
            ok: false,
            enabled: true,
            paused: false,
            judgments: [],
            scanned: 0,
            hidden: 0,
            status: "error",
            reason,
          } satisfies JudgeBlocksResponse);
        });
      return true;
    }

    if (message.type === "GET_STATUS") {
      statusFor(tabId)
        .then(sendResponse)
        .catch(() => {
          sendResponse({
            enabled: false,
            paused: false,
            hasKey: false,
            threshold: 0.8,
            scanned: 0,
            hidden: 0,
            status: "error",
          } satisfies StatusPayload);
        });
      return true;
    }

    if (message.type === "SET_ENABLED") {
      saveSettings({ enabled: message.enabled })
        .then(() => statusFor(tabId))
        .then(sendResponse);
      return true;
    }

    if (message.type === "SET_PAUSED") {
      saveSettings({ paused: message.paused })
        .then(() => statusFor(tabId))
        .then(sendResponse);
      return true;
    }

    if (message.type === "REPORT_STATS") {
      rememberTab(tabId, {
        scanned: message.scanned,
        hidden: message.hidden,
        status: "idle",
      });
      sendResponse({ ok: true });
      return true;
    }

    return false;
  },
);
