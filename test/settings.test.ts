import { mergeSettings, parseHostList, sitePolicy } from "../src/lib/settings";

describe("settings merge", () => {
  test("uses defaults when storage is empty", () => {
    const settings = mergeSettings({});
    expect(settings.apiKey).toBe("");
    expect(settings.enabled).toBe(true);
    expect(settings.threshold).toBe(0.8);
    expect(
      settings.rules.some((rule) => rule.id === "ads" && rule.enabled),
    ).toBe(true);
  });

  test("keeps a stored key only from chrome.storage-shaped input", () => {
    const settings = mergeSettings({ apiKey: "stored-key", threshold: 0.9 });
    expect(settings.apiKey).toBe("stored-key");
    expect(settings.threshold).toBe(0.9);
  });
});

describe("site policy", () => {
  test("deny wins and an empty allowlist scans everywhere else", () => {
    expect(sitePolicy("mail.example.com", [], ["mail.example.com"])).toBe(
      "skip",
    );
    expect(sitePolicy("news.example.com", [], ["mail.example.com"])).toBe(
      "scan",
    );
  });

  test("a non-empty allowlist is exclusive", () => {
    expect(sitePolicy("news.example.com", ["example.com"], [])).toBe("scan");
    expect(sitePolicy("other.test", ["example.com"], [])).toBe("skip");
  });

  test("parseHostList trims blank lines", () => {
    expect(parseHostList("Example.COM\n\nmail.example.com\n")).toEqual([
      "example.com",
      "mail.example.com",
    ]);
  });
});
