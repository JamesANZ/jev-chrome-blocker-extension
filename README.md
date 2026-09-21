# Jev Chrome Content Blocker

A personal Manifest V3 extension that hides **page blocks** matching your rules. [JEV](https://typesafe.ai) (TypeSafe System One) is a **judgment API**, not a chat model: each rule becomes one closed yes/no (`noul`) question, and the extension hides a block when any enabled score is at or above your threshold (default **0.80**).

This is not an LLM rewriter. The extension never asks JEV to generate CSS or rewrite the page.

## Privacy

Block text, the page URL, and the page title are sent to TypeSafe (`https://api.typesafe.ai/v1/systemone`) so JEV can judge them. The TypeSafe API key is stored only in `chrome.storage.local` via the Options page. It is **never** committed, baked into the build, or injected into the content script.

## Install (unpacked)

1. In this directory: `npm install && npm test && npm run build`
2. Open `chrome://extensions`
3. Turn on **Developer mode**
4. Click **Load unpacked** and select the `dist/` folder

After you change source, run `npm run build` and click **Reload** on the extension card.

## API key

Paste `TYPESAFE_API_KEY` on the Options page (right-click the toolbar icon → Options).

Copy the value from the same place you already use for medical-mcp:

- **Claude Desktop:** the `TYPESAFE_API_KEY` entry in `medical-mcp.env` or your Claude MCP server env
- **Cursor:** the `TYPESAFE_API_KEY` env var on the medical-mcp (or TypeSafe) MCP server in Cursor Settings → MCP

Do not check the key into git. Do not put it in `.env` for this project. The extension reads it only from `chrome.storage.local`.

## Rules

Presets (each is one noul):

- **Hide ads** — on by default
- **Hide political content**
- **Hide negative content**

You can add custom rules as plain language (“Hide celebrity gossip”). Enabled rules are sent together on each block. The service worker caches judgments by `hash(normalized text + rule ids + model)`.

1. Add or enable a rule and set a threshold
2. Reload a page (or use **Rescan page** in the popup)
3. Hidden blocks collapse to a chip: `Hidden by Jev · political 0.91`
4. Click **Show** on a chip to reveal a false positive

The popup can pause scanning or disable the extension without deleting the key.

## Cost and limits

Pricing is cheap per token (on the order of **$0.042 / MTok**) but a busy feed is still many requests. Budget controls in v1:

- Cap of ~40 blocks per page
- ~1–2k characters of text per block
- In-memory hash cache
- Concurrency 6, 3s timeout
- Fail-soft on missing key, timeout, 429, or 529 (`retry-after` is honoured; the block stays visible)

**Text only.** JEV cannot see images or video. Image ads without nearby alt/aria/link text will be missed.

Site allow/deny lists live on the Options page. Deny always wins. An empty allowlist means every site except the denylist.

## Development

```bash
npm install
npm test
npm run typecheck
npm run build
```

Tests use Vitest + jsdom and a **mocked** HTTP poster. CI and `npm test` never call TypeSafe.

Pinned model: `jev-1.13.0`.

## Honest limits

JEV will mis-fire on sarcasm, mixed political-news, and native ads that look like articles. The reveal chip and a high default threshold are the safety valve. Whole-page “is this site political?” is a different product; this one hides **blocks**.
