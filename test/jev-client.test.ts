/**
 * JEV client tests with a fake HTTP POST. No live TypeSafe calls.
 */

import {
  buildJevRequest,
  judgeBlock,
  parseJevAnswers,
  parseRetryAfterMs,
  JEV_ENDPOINT,
} from "../src/lib/jev-client";
import { compileRules } from "../src/lib/rules";
import { JEV_MODEL, type JevState, type NoulQuestion } from "../src/lib/types";

const sampleState: JevState = {
  url: "https://example.com/post",
  page_title: "Example post",
  text: "Sponsored placement for a vacation package. Book now and save.",
};

const questions: Record<string, NoulQuestion> = compileRules([
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
]);

describe("buildJevRequest", () => {
  test("pins jev-1.13.0 and sends only state + questions", () => {
    const body = buildJevRequest(sampleState, questions);
    expect(body.model).toBe(JEV_MODEL);
    expect(body.model).toBe("jev-1.13.0");
    expect(body.state).toEqual(sampleState);
    expect(Object.keys(body.questions)).toEqual(["ads"]);
    expect(body.questions.ads.type).toBe("noul");
    expect(JSON.stringify(body)).not.toMatch(/apiKey|TYPESAFE|Authorization/i);
    expect(Object.keys(body).sort()).toEqual(["model", "questions", "state"]);
  });
});

describe("parseJevAnswers", () => {
  test("reads noul fields for the requested questions", () => {
    const parsed = parseJevAnswers(
      {
        model: "jev-1.13.0",
        answers: {
          ads: { type: "noul", noul: 0.91 },
        },
      },
      ["ads"],
    );
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.scores.ads).toBe(0.91);
      expect(parsed.model).toBe("jev-1.13.0");
    }
  });

  test("fails closed on a missing answers object", () => {
    const parsed = parseJevAnswers({}, ["ads"]);
    expect(parsed).toEqual({ ok: false, reason: "missing_answers" });
  });

  test("fails closed on incomplete answers", () => {
    const parsed = parseJevAnswers({ answers: {} }, ["ads"]);
    expect(parsed).toEqual({ ok: false, reason: "incomplete_answers" });
  });
});

describe("judgeBlock", () => {
  test("skips HTTP when the TypeSafe key is missing", async () => {
    const post = vi.fn();
    const result = await judgeBlock(sampleState, questions, () => "", post);
    expect(result).toEqual({ ok: false, reason: "missing_key" });
    expect(post).not.toHaveBeenCalled();
  });

  test("posts to System One and parses the body", async () => {
    const post = vi.fn(async (url: string, body: unknown) => {
      expect(url).toBe(JEV_ENDPOINT);
      expect((body as { model: string }).model).toBe(JEV_MODEL);
      return {
        body: {
          model: "jev-1.13.0",
          answers: { ads: { noul: 0.84 } },
        },
      };
    });
    const result = await judgeBlock(
      sampleState,
      questions,
      () => "test-key",
      post,
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.scores.ads).toBe(0.84);
    expect(post).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith(
      JEV_ENDPOINT,
      expect.objectContaining({ model: JEV_MODEL }),
      expect.objectContaining({ Authorization: "Bearer test-key" }),
    );
  });

  test("degrades when the POST throws", async () => {
    const post = vi.fn(async () => {
      throw new Error("timeout");
    });
    const result = await judgeBlock(
      sampleState,
      questions,
      () => "test-key",
      post,
    );
    expect(result).toEqual({ ok: false, reason: "call_failed" });
  });
});

describe("parseRetryAfterMs", () => {
  test("reads a delta-seconds header", () => {
    expect(parseRetryAfterMs("2")).toBe(2000);
  });
});
