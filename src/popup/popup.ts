import type { ExtensionMessage, StatusPayload } from "../lib/messages";

const statusEl = document.getElementById("status") as HTMLDivElement;
const enabledEl = document.getElementById("enabled") as HTMLInputElement;
const pausedEl = document.getElementById("paused") as HTMLInputElement;
const scannedEl = document.getElementById("scanned") as HTMLElement;
const hiddenEl = document.getElementById("hidden") as HTMLElement;
const hintEl = document.getElementById("hint") as HTMLParagraphElement;
const rescanEl = document.getElementById("rescan") as HTMLButtonElement;
const optionsEl = document.getElementById("open-options") as HTMLButtonElement;

const STATUS_LABEL: Record<StatusPayload["status"], string> = {
  idle: "Idle",
  scanning: "Scanning",
  paused: "Paused",
  disabled: "Disabled",
  missing_key: "Missing API key",
  skipped: "Site skipped",
  error: "Error",
};

async function activeTabId(): Promise<number | undefined> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.id;
}

function render(status: StatusPayload): void {
  statusEl.textContent = STATUS_LABEL[status.status] ?? status.status;
  statusEl.classList.toggle(
    "warn",
    status.status === "missing_key" || status.status === "error",
  );
  enabledEl.checked = status.enabled;
  pausedEl.checked = status.paused;
  scannedEl.textContent = String(status.scanned);
  hiddenEl.textContent = String(status.hidden);
  hintEl.textContent = status.hasKey
    ? "Hidden blocks stay collapsed until you reveal them."
    : "Paste TYPESAFE_API_KEY in Options. The key stays in chrome.storage.local.";
}

async function refresh(): Promise<void> {
  const tabId = await activeTabId();
  const status = (await chrome.runtime.sendMessage({
    type: "GET_STATUS",
    tabId,
  } satisfies ExtensionMessage)) as StatusPayload;
  render(status);
}

enabledEl.addEventListener("change", async () => {
  await chrome.runtime.sendMessage({
    type: "SET_ENABLED",
    enabled: enabledEl.checked,
  } satisfies ExtensionMessage);
  await refresh();
});

pausedEl.addEventListener("change", async () => {
  await chrome.runtime.sendMessage({
    type: "SET_PAUSED",
    paused: pausedEl.checked,
  } satisfies ExtensionMessage);
  await refresh();
});

rescanEl.addEventListener("click", async () => {
  const tabId = await activeTabId();
  if (tabId !== undefined) {
    try {
      await chrome.tabs.sendMessage(tabId, {
        type: "RESCAN",
      } satisfies ExtensionMessage);
    } catch {
      hintEl.textContent =
        "This page has no content script (chrome:// and the Web Store are skipped).";
    }
  }
  window.setTimeout(() => {
    void refresh();
  }, 400);
});

optionsEl.addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

void refresh();
