import { hashString, normalizeText } from "./cache";
import {
  BLOCK_TEXT_CHAR_LIMIT,
  MAX_BLOCKS_PER_PAGE,
  type ExtractedBlock,
} from "./types";

const SKIP_TAGS = new Set([
  "NAV",
  "HEADER",
  "FOOTER",
  "SCRIPT",
  "STYLE",
  "NOSCRIPT",
  "TEMPLATE",
  "SVG",
  "BUTTON",
  "INPUT",
  "SELECT",
  "TEXTAREA",
  "IFRAME",
]);

const CANDIDATE_SELECTORS = [
  "article",
  "[role='article']",
  "[role='listitem']",
  "aside",
  "li",
  "section",
  "[class*='comment' i]",
  "[class*='card' i]",
  "[class*='post' i]",
  "[class*='feed-item' i]",
  "[class*='ad-' i]",
  "[class*='ads-' i]",
  "[class*='advert' i]",
  "[class*='sponsor' i]",
  "[id*='ad-' i]",
  "[id*='sponsor' i]",
  "[data-ad]",
].join(",");

const AD_HINT =
  /(?:^|[\s_-])(?:ad|ads|advert|sponsor|sponsored|promo|promoted)(?:$|[\s_-])/i;

export function isAdish(el: Element): boolean {
  const haystack = [
    el.id,
    el.className?.toString?.() ?? "",
    el.getAttribute("role") ?? "",
    el.getAttribute("aria-label") ?? "",
    el.getAttribute("data-ad") ?? "",
  ].join(" ");
  return AD_HINT.test(haystack);
}

export function isSkipped(el: Element): boolean {
  let node: Element | null = el;
  while (node) {
    if (SKIP_TAGS.has(node.tagName)) return true;
    node = node.parentElement;
  }
  return false;
}

export function collectBlockText(el: Element): string {
  const seen = new Set<string>();
  const chunks: string[] = [];
  const push = (value: string) => {
    const text = value.replace(/\s+/g, " ").trim();
    if (text && !seen.has(text)) {
      seen.add(text);
      chunks.push(text);
    }
  };

  const htmlEl = el as HTMLElement;
  push(htmlEl.innerText || el.textContent || "");
  el.querySelectorAll("img[alt]").forEach((img) => {
    push(img.getAttribute("alt") || "");
  });
  el.querySelectorAll("[aria-label]").forEach((node) => {
    push(node.getAttribute("aria-label") || "");
  });
  el.querySelectorAll("a[href]").forEach((anchor) => {
    const label = (anchor.textContent || "").trim();
    if (label) push(label);
  });

  return chunks.join(" ").slice(0, BLOCK_TEXT_CHAR_LIMIT);
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function minWordsFor(el: Element): number {
  if (isAdish(el)) return 8;
  if (
    el.matches(
      "[role='listitem'], li, [class*='card' i], [class*='post' i], [class*='comment' i]",
    )
  ) {
    return 20;
  }
  return 40;
}

function keepOutermost(candidates: Element[]): Element[] {
  const set = new Set(candidates);
  return candidates.filter((el) => {
    let parent = el.parentElement;
    while (parent) {
      if (set.has(parent)) return false;
      parent = parent.parentElement;
    }
    return true;
  });
}

export function blockIdFor(text: string, index: number): string {
  return `b${index}-${hashString(normalizeText(text)).slice(0, 10)}`;
}

export function extractBlocks(
  root: Document | Element,
  options: { maxBlocks?: number; skipExisting?: boolean } = {},
): ExtractedBlock[] {
  const maxBlocks = options.maxBlocks ?? MAX_BLOCKS_PER_PAGE;
  const searchRoot = root instanceof Document ? root : root;
  const nodes = Array.from(searchRoot.querySelectorAll(CANDIDATE_SELECTORS));
  const viable = nodes.filter((el) => {
    if (options.skipExisting && el.hasAttribute("data-jev-id")) return false;
    if (isSkipped(el)) return false;
    const text = collectBlockText(el);
    return wordCount(text) >= minWordsFor(el);
  });

  const unique = keepOutermost(viable).slice(0, maxBlocks);
  return unique.map((el, index) => {
    const text = collectBlockText(el);
    const id = el.getAttribute("data-jev-id") || blockIdFor(text, index);
    el.setAttribute("data-jev-id", id);
    return {
      id,
      text,
      tagName: el.tagName.toLowerCase(),
    };
  });
}

export function findBlockElement(
  root: Document | Element,
  id: string,
): Element | null {
  return root.querySelector(`[data-jev-id="${cssEscape(id)}"]`);
}

function cssEscape(value: string): string {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(value);
  }
  return value.replace(/["\\]/g, "\\$&");
}
