import { clampThreshold } from "./policy";
import { clonePresetRules } from "./rules";
import {
  DEFAULT_THRESHOLD,
  type ExtensionSettings,
  type HideRule,
} from "./types";

export const STORAGE_FIELDS = [
  "apiKey",
  "enabled",
  "paused",
  "threshold",
  "rules",
  "siteAllowlist",
  "siteDenylist",
] as const;

export function defaultSettings(): ExtensionSettings {
  return {
    apiKey: "",
    enabled: true,
    paused: false,
    threshold: DEFAULT_THRESHOLD,
    rules: clonePresetRules(),
    siteAllowlist: [],
    siteDenylist: [],
  };
}

function isHideRule(value: unknown): value is HideRule {
  if (!value || typeof value !== "object") return false;
  const rule = value as HideRule;
  return (
    typeof rule.id === "string" &&
    typeof rule.label === "string" &&
    typeof rule.enabled === "boolean" &&
    typeof rule.instructions === "string" &&
    !!rule.criteria &&
    typeof rule.criteria.true === "string" &&
    typeof rule.criteria.false === "string"
  );
}

export function parseHostList(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim().toLowerCase())
    .filter(Boolean);
}

export function hostMatches(hostname: string, pattern: string): boolean {
  const host = hostname.toLowerCase();
  const needle = pattern.toLowerCase().replace(/^\./, "");
  return host === needle || host.endsWith(`.${needle}`);
}

/**
 * Empty allowlist means all sites (minus deny). A non-empty allowlist is
 * exclusive. Deny always wins.
 */
export function sitePolicy(
  hostname: string,
  allowlist: string[],
  denylist: string[],
): "scan" | "skip" {
  if (denylist.some((entry) => hostMatches(hostname, entry))) return "skip";
  if (
    allowlist.length > 0 &&
    !allowlist.some((entry) => hostMatches(hostname, entry))
  ) {
    return "skip";
  }
  return "scan";
}

export function mergeSettings(raw: Record<string, unknown>): ExtensionSettings {
  const defaults = defaultSettings();
  const rules = Array.isArray(raw.rules) ? raw.rules.filter(isHideRule) : [];
  return {
    apiKey: typeof raw.apiKey === "string" ? raw.apiKey : "",
    enabled: raw.enabled !== false,
    paused: raw.paused === true,
    threshold: clampThreshold(raw.threshold),
    rules: rules.length > 0 ? rules : defaults.rules,
    siteAllowlist: Array.isArray(raw.siteAllowlist)
      ? raw.siteAllowlist.filter(
          (item): item is string => typeof item === "string",
        )
      : [],
    siteDenylist: Array.isArray(raw.siteDenylist)
      ? raw.siteDenylist.filter(
          (item): item is string => typeof item === "string",
        )
      : [],
  };
}

export async function loadSettings(): Promise<ExtensionSettings> {
  const raw = await chrome.storage.local.get([...STORAGE_FIELDS]);
  return mergeSettings(raw);
}

export async function saveSettings(
  patch: Partial<ExtensionSettings>,
): Promise<ExtensionSettings> {
  const current = await loadSettings();
  const next = { ...current, ...patch };
  await chrome.storage.local.set({
    apiKey: next.apiKey,
    enabled: next.enabled,
    paused: next.paused,
    threshold: next.threshold,
    rules: next.rules,
    siteAllowlist: next.siteAllowlist,
    siteDenylist: next.siteDenylist,
  });
  return next;
}
