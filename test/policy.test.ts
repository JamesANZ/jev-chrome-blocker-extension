import { decideHide } from "../src/lib/policy";
import { clonePresetRules } from "../src/lib/rules";

const rules = clonePresetRules().map((rule) => ({ ...rule, enabled: true }));

describe("threshold policy", () => {
  test("hides when any enabled noul is at or above 0.80", () => {
    const decision = decideHide(
      { ads: 0.2, political: 0.91, negative: 0.1 },
      rules,
      0.8,
    );
    expect(decision.hide).toBe(true);
    expect(decision.matchedRuleId).toBe("political");
    expect(decision.matchedRuleLabel).toBe("political");
    expect(decision.noul).toBe(0.91);
  });

  test("keeps the block when every noul is under the threshold", () => {
    const decision = decideHide({ ads: 0.4, political: 0.79 }, rules, 0.8);
    expect(decision.hide).toBe(false);
    expect(decision.matchedRuleId).toBeUndefined();
  });

  test("fail-soft keeps the block when scores are missing", () => {
    expect(decideHide(undefined, rules, 0.8)).toEqual({ hide: false });
  });

  test("ignores disabled rules even if their noul is high", () => {
    const adsOnly = clonePresetRules();
    const decision = decideHide({ ads: 0.1, political: 0.99 }, adsOnly, 0.8);
    expect(decision.hide).toBe(false);
  });

  test("picks the highest matching noul when several rules fire", () => {
    const decision = decideHide({ ads: 0.85, negative: 0.93 }, rules, 0.8);
    expect(decision.hide).toBe(true);
    expect(decision.matchedRuleId).toBe("negative");
    expect(decision.noul).toBe(0.93);
  });
});
