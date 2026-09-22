/**
 * Headed Chrome + unpacked extension. Screenshots via CDP, not macOS capture.
 * Requires TYPESAFE_API_KEY. Never logs the key.
 */
import puppeteer from "puppeteer-core";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const EXT = path.resolve(import.meta.dirname, "..", "dist");
const OUT = path.resolve(import.meta.dirname, "..", "demo", "screenshots");
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const API_KEY = process.env.TYPESAFE_API_KEY || "";

if (!API_KEY) {
  console.error("TYPESAFE_API_KEY is missing");
  process.exit(1);
}

const PAGES = [
  {
    name: "01-demo-page",
    url: "http://127.0.0.1:4177/",
    waitMs: 8000,
  },
  {
    name: "02-guardian-us",
    url: "https://www.theguardian.com/us",
    waitMs: 14000,
  },
  {
    name: "03-bbc-news",
    url: "https://www.bbc.com/news",
    waitMs: 14000,
  },
];

function chipSummary(report) {
  return {
    href: report.href,
    chips: report.chips,
    hidden: report.hidden,
    marked: report.marked,
    labels: report.labels,
  };
}

async function pageReport(page) {
  return page.evaluate(() => {
    const chips = Array.from(document.querySelectorAll(".jev-chip"));
    return {
      href: location.href,
      title: document.title,
      chips: chips.length,
      hidden: document.querySelectorAll("[data-jev-hidden='1']").length,
      marked: document.querySelectorAll("[data-jev-id]").length,
      labels: chips.map((el) =>
        (el.textContent || "").replace(/\s+/g, " ").trim(),
      ),
    };
  });
}

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: false,
  args: [
    `--disable-extensions-except=${EXT}`,
    `--load-extension=${EXT}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--window-size=1280,900",
  ],
});

try {
  const workerTarget = await browser.waitForTarget(
    (target) =>
      target.type() === "service_worker" &&
      target.url().includes("chrome-extension://"),
    { timeout: 20000 },
  );
  const extId = new URL(workerTarget.url()).hostname;
  const worker = await workerTarget.worker();
  if (!worker) throw new Error("extension service worker missing");

  await worker.evaluate(async (apiKey) => {
    const current = await chrome.storage.local.get([
      "rules",
      "threshold",
      "enabled",
    ]);
    const rules = Array.isArray(current.rules)
      ? current.rules.map((rule) => ({
          ...rule,
          enabled:
            rule.id === "ads" ||
            rule.id === "political" ||
            rule.id === "negative" ||
            rule.enabled,
        }))
      : undefined;
    await chrome.storage.local.set({
      apiKey,
      enabled: true,
      paused: false,
      threshold: 0.8,
      ...(rules ? { rules } : {}),
    });
  }, API_KEY);

  await mkdir(OUT, { recursive: true });
  const summary = [];

  const pages = await browser.pages();
  const page = pages[0] ?? (await browser.newPage());
  await page.setViewport({ width: 1280, height: 860 });

  for (const item of PAGES) {
    await page.goto(item.url, {
      waitUntil: "domcontentloaded",
      timeout: 45000,
    });
    await page
      .waitForFunction(
        () =>
          document.querySelectorAll(".jev-chip").length > 0 ||
          document.querySelectorAll("[data-jev-id]").length > 0,
        { timeout: item.waitMs },
      )
      .catch(() => {});
    await new Promise((r) => setTimeout(r, 2500));

    const report = await pageReport(page);
    const png = path.join(OUT, `${item.name}.png`);
    await page.screenshot({ path: png, fullPage: false });
    summary.push({ file: `${item.name}.png`, ...chipSummary(report) });
    console.log(JSON.stringify({ file: item.name, ...chipSummary(report) }));
  }

  await writeFile(
    path.join(OUT, "summary.json"),
    JSON.stringify(summary, null, 2),
  );
} finally {
  await browser.close();
}
