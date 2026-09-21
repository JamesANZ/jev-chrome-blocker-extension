import {
  compileRules,
  PRESET_RULES,
  ruleFromCustomText,
} from "../src/lib/rules";

describe("rule compiler", () => {
  test("compiles enabled presets into a valid noul map", () => {
    const questions = compileRules(
      PRESET_RULES.map((rule) => ({ ...rule, enabled: true })),
    );
    expect(Object.keys(questions).sort()).toEqual([
      "ads",
      "negative",
      "political",
    ]);
    for (const question of Object.values(questions)) {
      expect(question.type).toBe("noul");
      expect(question.instructions.length).toBeGreaterThan(10);
      expect(question.criteria.true.length).toBeGreaterThan(3);
      expect(question.criteria.false.length).toBeGreaterThan(3);
    }
  });

  test("omits disabled rules", () => {
    const questions = compileRules(PRESET_RULES);
    expect(Object.keys(questions)).toEqual(["ads"]);
  });

  test("turns custom text into a noul question", () => {
    const rule = ruleFromCustomText("Hide celebrity gossip");
    expect(rule.enabled).toBe(true);
    expect(rule.label).toBe("Hide celebrity gossip");
    const questions = compileRules([rule]);
    const [question] = Object.values(questions);
    expect(question.type).toBe("noul");
    expect(question.instructions).toContain("Hide celebrity gossip");
    expect(question.criteria.true).toContain("Hide celebrity gossip");
    expect(question.criteria.false).toContain("Hide celebrity gossip");
  });
});
