import { DEFAULT_THRESHOLD, type HideDecision, type HideRule } from "./types";

/**
 * Hide when any enabled rule's noul is at or above the threshold.
 * Fail-soft: missing or unusable scores leave the block visible.
 */
export function decideHide(
  scores: Record<string, number> | undefined,
  rules: HideRule[],
  threshold: number = DEFAULT_THRESHOLD,
): HideDecision {
  if (!scores) return { hide: false };

  let best: HideDecision = { hide: false, scores };
  for (const rule of rules) {
    if (!rule.enabled) continue;
    const noul = scores[rule.id];
    if (typeof noul !== "number") continue;
    if (noul >= threshold && (!best.hide || noul > (best.noul ?? 0))) {
      best = {
        hide: true,
        matchedRuleId: rule.id,
        matchedRuleLabel: shortLabel(rule),
        noul,
        scores,
      };
    }
  }
  return best;
}

export function shortLabel(rule: HideRule): string {
  return rule.preset ?? rule.id;
}

export function clampThreshold(value: unknown): number {
  if (typeof value !== "number" || Number.isNaN(value))
    return DEFAULT_THRESHOLD;
  return Math.min(0.99, Math.max(0.5, value));
}
