import {
  JudgmentCache,
  cacheKey,
  hashString,
  normalizeText,
} from "../src/lib/cache";
import { JEV_MODEL } from "../src/lib/types";

describe("cache key stability", () => {
  test("same normalized text, rule ids, and model produce the same key", () => {
    const a = cacheKey("  Hello   world\n", ["political", "ads"], JEV_MODEL);
    const b = cacheKey("hello world", ["ads", "political"], "jev-1.13.0");
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{8}$/);
  });

  test("different text or model changes the key", () => {
    const base = cacheKey("hello world", ["ads"], JEV_MODEL);
    expect(cacheKey("hello worlds", ["ads"], JEV_MODEL)).not.toBe(base);
    expect(cacheKey("hello world", ["ads"], "jev-other")).not.toBe(base);
    expect(cacheKey("hello world", ["ads", "political"], JEV_MODEL)).not.toBe(
      base,
    );
  });

  test("normalizeText collapses whitespace and case", () => {
    expect(normalizeText("  Foo\tBAR  ")).toBe("foo bar");
    expect(hashString("abc")).toBe(hashString("abc"));
  });
});

describe("JudgmentCache", () => {
  test("stores scores and evicts the oldest entry", () => {
    const cache = new JudgmentCache(2);
    cache.set("a", { ads: 0.1 });
    cache.set("b", { ads: 0.2 });
    cache.set("c", { ads: 0.3 });
    expect(cache.get("a")).toBeUndefined();
    expect(cache.get("b")?.ads).toBe(0.2);
    expect(cache.get("c")?.ads).toBe(0.3);
  });
});
