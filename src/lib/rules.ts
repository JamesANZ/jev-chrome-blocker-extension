import { hashString } from "./cache";
import type { HideRule, NoulQuestion } from "./types";

export const PRESET_RULES: HideRule[] = [
  {
    id: "ads",
    label: "Hide ads",
    enabled: true,
    preset: "ads",
    instructions:
      "This block is an advertisement, sponsored placement, or promotional content.",
    criteria: {
      true: "Paid, sponsored, or click-driving promotion",
      false: "Editorial or user content",
    },
  },
  {
    id: "political",
    label: "Hide political content",
    enabled: false,
    preset: "political",
    instructions:
      "This block is political content: partisan advocacy, campaigning, or electoral persuasion.",
    criteria: {
      true: "Partisan, campaign, or electoral political advocacy",
      false: "Non-political editorial or personal content",
    },
  },
  {
    id: "negative",
    label: "Hide negative content",
    enabled: false,
    preset: "negative",
    instructions:
      "This block is predominantly negative, hostile, or fear-inducing.",
    criteria: {
      true: "Hostile, fear-inducing, or overwhelmingly negative tone",
      false: "Neutral, constructive, or mixed-tone content",
    },
  },
];

export function clonePresetRules(): HideRule[] {
  return PRESET_RULES.map((rule) => ({
    ...rule,
    criteria: { ...rule.criteria },
  }));
}

/** User text → one noul question. */
export function ruleFromCustomText(text: string, id?: string): HideRule {
  const label = text.trim();
  return {
    id: id ?? `custom-${hashString(label).slice(0, 8)}`,
    label,
    enabled: true,
    instructions: `This block is content the user asked to hide: ${label}`,
    criteria: {
      true: `The block matches this hide rule: ${label}`,
      false: `The block does not match this hide rule: ${label}`,
    },
  };
}

/**
 * Compile enabled rules into a JEV questions map. One noul per rule.
 * Disabled rules are omitted so we do not pay for them.
 */
export function compileRules(rules: HideRule[]): Record<string, NoulQuestion> {
  const questions: Record<string, NoulQuestion> = {};
  for (const rule of rules) {
    if (!rule.enabled) continue;
    if (!rule.id || !rule.instructions) continue;
    questions[rule.id] = {
      type: "noul",
      instructions: rule.instructions,
      criteria: {
        true: rule.criteria.true,
        false: rule.criteria.false,
      },
    };
  }
  return questions;
}

export function enabledRuleIds(rules: HideRule[]): string[] {
  return Object.keys(compileRules(rules)).sort();
}
