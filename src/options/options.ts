import { clonePresetRules, ruleFromCustomText } from "../lib/rules";
import { loadSettings, parseHostList, saveSettings } from "../lib/settings";
import type { HideRule } from "../lib/types";

const form = document.getElementById("options-form") as HTMLFormElement;
const apiKeyEl = document.getElementById("api-key") as HTMLInputElement;
const thresholdEl = document.getElementById("threshold") as HTMLInputElement;
const thresholdValueEl = document.getElementById(
  "threshold-value",
) as HTMLElement;
const presetEl = document.getElementById("preset-rules") as HTMLDivElement;
const customListEl = document.getElementById("custom-rules") as HTMLDivElement;
const customInputEl = document.getElementById(
  "custom-rule",
) as HTMLInputElement;
const addRuleEl = document.getElementById("add-rule") as HTMLButtonElement;
const allowEl = document.getElementById("allowlist") as HTMLTextAreaElement;
const denyEl = document.getElementById("denylist") as HTMLTextAreaElement;
const statusEl = document.getElementById("status") as HTMLParagraphElement;

let rules: HideRule[] = clonePresetRules();

function isPreset(rule: HideRule): boolean {
  return rule.preset !== undefined;
}

function renderThreshold(): void {
  const value = Number(thresholdEl.value);
  thresholdValueEl.textContent = value.toFixed(2);
}

function renderRules(): void {
  presetEl.replaceChildren();
  customListEl.replaceChildren();

  for (const rule of rules) {
    const row = document.createElement("label");
    row.className = "rule";
    const box = document.createElement("input");
    box.type = "checkbox";
    box.checked = rule.enabled;
    box.addEventListener("change", () => {
      rule.enabled = box.checked;
    });
    const copy = document.createElement("span");
    copy.textContent = rule.label;
    row.append(box, copy);

    if (isPreset(rule)) {
      presetEl.append(row);
    } else {
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "secondary";
      remove.textContent = "Remove";
      remove.addEventListener("click", () => {
        rules = rules.filter((item) => item.id !== rule.id);
        renderRules();
      });
      row.append(remove);
      customListEl.append(row);
    }
  }
}

addRuleEl.addEventListener("click", () => {
  const text = customInputEl.value.trim();
  if (text.length < 3) return;
  rules = [...rules, ruleFromCustomText(text)];
  customInputEl.value = "";
  renderRules();
});

thresholdEl.addEventListener("input", renderThreshold);

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  await saveSettings({
    apiKey: apiKeyEl.value.trim(),
    threshold: Number(thresholdEl.value),
    rules,
    siteAllowlist: parseHostList(allowEl.value),
    siteDenylist: parseHostList(denyEl.value),
  });
  statusEl.hidden = false;
  window.setTimeout(() => {
    statusEl.hidden = true;
  }, 1500);
});

async function init(): Promise<void> {
  const settings = await loadSettings();
  apiKeyEl.value = settings.apiKey;
  thresholdEl.value = String(settings.threshold);
  rules = settings.rules;
  allowEl.value = settings.siteAllowlist.join("\n");
  denyEl.value = settings.siteDenylist.join("\n");
  renderThreshold();
  renderRules();
}

void init();
