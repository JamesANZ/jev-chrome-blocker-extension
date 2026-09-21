import { extractBlocks, findBlockElement } from "../lib/blocks";
import type {
  ExtensionMessage,
  JudgeBlocksResponse,
  RescanMessage,
} from "../lib/messages";
import type { BlockJudgment } from "../lib/types";

const judgedIds = new Set<string>();
let observer: MutationObserver | null = null;
let debounceTimer: number | undefined;
let scanning = false;

function chipLabel(judgment: BlockJudgment): string {
  const name = judgment.matchedRuleLabel ?? judgment.matchedRuleId ?? "rule";
  const score =
    typeof judgment.noul === "number" ? judgment.noul.toFixed(2) : "";
  return score ? `Hidden by Jev · ${name} ${score}` : `Hidden by Jev · ${name}`;
}

function existingChip(el: Element): HTMLElement | null {
  const prev = el.previousElementSibling;
  if (prev instanceof HTMLElement && prev.classList.contains("jev-chip"))
    return prev;
  return null;
}

function hideBlock(el: Element, judgment: BlockJudgment): void {
  el.setAttribute("data-jev-hidden", "1");
  let chip = existingChip(el);
  if (!chip) {
    chip = document.createElement("div");
    chip.className = "jev-chip";
    chip.setAttribute("data-jev-chip-for", judgment.blockId);
    el.before(chip);
  }
  renderChip(chip, el, judgment, false);
}

function revealBlock(el: Element, judgment: BlockJudgment): void {
  el.setAttribute("data-jev-hidden", "0");
  const chip = existingChip(el);
  if (chip) renderChip(chip, el, judgment, true);
}

function renderChip(
  chip: HTMLElement,
  el: Element,
  judgment: BlockJudgment,
  revealed: boolean,
): void {
  chip.dataset.jevRevealed = revealed ? "1" : "0";
  chip.replaceChildren();
  const text = document.createElement("span");
  text.textContent = revealed
    ? chipLabel(judgment).replace("Hidden by Jev", "Shown")
    : chipLabel(judgment);
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = revealed ? "Hide" : "Show";
  button.addEventListener("click", () => {
    if (el.getAttribute("data-jev-hidden") === "1") revealBlock(el, judgment);
    else hideBlock(el, judgment);
  });
  chip.append(text, button);
}

function applyJudgments(judgments: BlockJudgment[]): number {
  let hidden = 0;
  for (const judgment of judgments) {
    judgedIds.add(judgment.blockId);
    const el = findBlockElement(document, judgment.blockId);
    if (!el) continue;
    if (judgment.hide) {
      hideBlock(el, judgment);
      hidden += 1;
    }
  }
  return hidden;
}

function revealAll(): void {
  document.querySelectorAll("[data-jev-hidden='1']").forEach((el) => {
    el.setAttribute("data-jev-hidden", "0");
  });
  document.querySelectorAll(".jev-chip").forEach((chip) => chip.remove());
}

async function canScan(): Promise<boolean> {
  const raw = await chrome.storage.local.get(["enabled", "paused"]);
  if (raw.enabled === false) {
    revealAll();
    return false;
  }
  if (raw.paused === true) return false;
  return true;
}

async function scan(force = false): Promise<void> {
  if (scanning) return;
  if (!(await canScan())) return;

  scanning = true;
  try {
    const blocks = extractBlocks(document, {
      skipExisting: !force,
    }).filter((block) => force || !judgedIds.has(block.id));
    if (blocks.length === 0) return;

    const response = (await chrome.runtime.sendMessage({
      type: "JUDGE_BLOCKS",
      pageUrl: location.href,
      pageTitle: document.title,
      blocks: blocks.map((block) => ({ id: block.id, text: block.text })),
    } satisfies ExtensionMessage)) as JudgeBlocksResponse | undefined;

    if (!response || !response.ok) return;
    const hidden = applyJudgments(response.judgments);
    await chrome.runtime.sendMessage({
      type: "REPORT_STATS",
      scanned: judgedIds.size,
      hidden:
        document.querySelectorAll("[data-jev-hidden='1']").length || hidden,
    } satisfies ExtensionMessage);
  } catch {
    // Fail-soft: leave the page as-is.
  } finally {
    scanning = false;
  }
}

function scheduleScan(): void {
  if (debounceTimer) window.clearTimeout(debounceTimer);
  debounceTimer = window.setTimeout(() => {
    void scan(false);
  }, 500);
}

function startObserver(): void {
  if (observer) return;
  observer = new MutationObserver((mutations) => {
    const relevant = mutations.some((mutation) => {
      return Array.from(mutation.addedNodes).some((node) => {
        if (!(node instanceof Element)) return false;
        if (node.classList.contains("jev-chip")) return false;
        return true;
      });
    });
    if (relevant) scheduleScan();
  });
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
}

chrome.runtime.onMessage.addListener((message: RescanMessage) => {
  if (message.type === "RESCAN") {
    judgedIds.clear();
    void scan(true);
  }
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (changes.enabled && changes.enabled.newValue === false) {
    revealAll();
    return;
  }
  if (changes.enabled || changes.paused || changes.rules || changes.threshold) {
    void scan(true);
  }
});

void scan(true);
startObserver();
