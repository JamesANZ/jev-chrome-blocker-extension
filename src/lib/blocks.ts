import { hashString, normalizeText } from "./cache";
import {
  BLOCK_TEXT_CHAR_LIMIT,
  MAX_BLOCKS_PER_PAGE,
  type ExtractedBlock,
} from "./types";

const HARD_SKIP_TAGS = new Set([
  "SCRIPT",
  "STYLE",
  "NOSCRIPT",
  "TEMPLATE",
  "SVG",
  "BUTTON",
  "INPUT",
  "SELECT",
  "TEXTAREA",
]);

const CHROME_SKIP_TAGS = new Set(["NAV", "HEADER", "FOOTER"]);

const CONTENT_SELECTORS = [
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
].join(",");

const AD_ATTR_SELECTORS = [
  "[class*='ad-' i]",
  "[class*='ads-' i]",
  "[class*='-ad-' i]",
  "[class$='-ad' i]",
  "[class$='_ad' i]",
  "[class*='advert' i]",
  "[class*='sponsor' i]",
  "[id*='ad-' i]",
  "[id*='ads-' i]",
  "[id^='ad_' i]",
  "[id*='_ad_' i]",
  "[id*='google_ads' i]",
  "[id*='sponsor' i]",
  "[data-ad]",
  "[data-ad-slot]",
  "[data-google-query-id]",
  "ins.adsbygoogle",
  "[class*='ad-wrapper' i]",
  "[class*='medium-rectangle' i]",
  "[class*='leaderboard-atf' i]",
  "iframe[id*='google_ads' i]",
  "iframe[id*='aswift' i]",
].join(",");

const AD_IFRAME_HOST =
  /doubleclick|googlesyndication|googleadservices|adservice\.google|googleads|imasdk|2mdn\.net|tpc\.googlesyndication|safeframe|amazon-adsystem|adnxs|adsrvr|adsystem|moatads|outbrain|taboola|carbonads|spotx|prebid|criteo|pubmatic|aniview|unruly|teads|smartadserver|serving-sys|adsafeprotected|pagead2/i;

const AD_HINT =
  /(?:^|[\s_-])(?:ad|ads|advert|sponsor|sponsored|promo|promoted)(?:$|[\s_-])/i;

const AD_BADGE = /^(ad|ads|advertisement|advert|sponsored)$/i;

export function isAdish(el: Element): boolean {
  const haystack = [
    el.id,
    el.className?.toString?.() ?? "",
    el.getAttribute("role") ?? "",
    el.getAttribute("aria-label") ?? "",
    el.getAttribute("data-ad") ?? "",
    el.getAttribute("data-ad-slot") ?? "",
    el.getAttribute("data-google-query-id") ?? "",
  ].join(" ");
  return AD_HINT.test(haystack) || hasAdBadge(el) || hasAdIframe(el);
}

export function hasAdBadge(el: Element): boolean {
  const own = (el.textContent || "").trim();
  if (own.length < 24 && AD_BADGE.test(own)) return true;
  return Array.from(el.children).some((child) =>
    AD_BADGE.test((child.textContent || "").trim()),
  );
}

export function hasAdIframe(el: Element): boolean {
  if (el.tagName === "IFRAME") return iframeLooksLikeAd(el);
  return Array.from(el.children).some(
    (child) => child.tagName === "IFRAME" && iframeLooksLikeAd(child),
  );
}

function iframeLooksLikeAd(iframe: Element): boolean {
  const src =
    iframe.getAttribute("src") || iframe.getAttribute("data-src") || "";
  const id = iframe.id || "";
  const name = iframe.getAttribute("name") || "";
  const title = iframe.getAttribute("title") || "";
  return (
    AD_IFRAME_HOST.test(src) ||
    /google_ads|ad_iframe|adsystem|doubleclick/i.test(
      `${id} ${name} ${title} ${src}`,
    )
  );
}

function isPageRoot(el: Element | null): boolean {
  return (
    !el ||
    el === el.ownerDocument?.documentElement ||
    el.tagName === "BODY" ||
    el.tagName === "HTML"
  );
}

function isHardSkipped(el: Element): boolean {
  let node: Element | null = el;
  while (node && !isPageRoot(node)) {
    if (HARD_SKIP_TAGS.has(node.tagName)) return true;
    node = node.parentElement;
  }
  return false;
}

export function isSkipped(el: Element): boolean {
  if (isHardSkipped(el)) return true;
  if (isAdish(el)) return false;
  let node: Element | null = el;
  while (node && !isPageRoot(node)) {
    if (CHROME_SKIP_TAGS.has(node.tagName)) return true;
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

  if (hasAdBadge(el)) push("This unit is labeled AD.");
  if (looksLikeMediaAdSlot(el)) {
    push("This unit is a video or iframe advertisement slot.");
  }

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
  el.querySelectorAll("iframe").forEach((iframe) => {
    push(iframe.getAttribute("title") || "");
    push(iframe.getAttribute("name") || "");
    try {
      const src = iframe.getAttribute("src") || "";
      if (src) push(`iframe ${new URL(src, "https://example.com").hostname}`);
    } catch {
      /* ignore bad src */
    }
  });

  return chunks.join(" ").slice(0, BLOCK_TEXT_CHAR_LIMIT);
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function looksLikeMediaAdSlot(el: Element): boolean {
  if (el.tagName === "IFRAME" || el.tagName === "VIDEO") return true;
  return Boolean(el.querySelector("iframe, video"));
}

function looksLikeCtaCard(el: Element): boolean {
  const text = (el.textContent || "").replace(/\s+/g, " ").trim();
  const words = wordCount(text);
  return (
    words > 0 &&
    words <= 24 &&
    /learn more|shop now|install now|download|get offer/i.test(text)
  );
}

function minWordsFor(el: Element): number {
  if (isAdish(el) || looksLikeMediaAdSlot(el)) return 1;
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

function climbAdSlot(start: Element): Element {
  let best = start;
  let current: Element | null = start.parentElement;
  for (let i = 0; i < 5 && current && !isPageRoot(current); i += 1) {
    if (HARD_SKIP_TAGS.has(current.tagName)) break;
    const ownAd =
      hasAdBadge(current) ||
      hasAdIframe(current) ||
      AD_HINT.test(`${current.id} ${current.className?.toString?.() ?? ""}`);
    if (!ownAd) break;
    if (wordCount(collectBlockText(current)) > 60) break;
    best = current;
    current = current.parentElement;
  }
  return best;
}

function collectAdSlots(root: Document | Element): Element[] {
  const slots = new Set<Element>();

  root.querySelectorAll(AD_ATTR_SELECTORS).forEach((el) => {
    if (!isHardSkipped(el)) slots.add(climbAdSlot(el));
  });

  root.querySelectorAll("iframe").forEach((iframe) => {
    if (!iframeLooksLikeAd(iframe)) return;
    const host =
      iframe.parentElement && !isPageRoot(iframe.parentElement)
        ? iframe.parentElement
        : iframe;
    if (!isHardSkipped(host)) slots.add(climbAdSlot(host));
  });

  const badgeNodes = Array.from(
    root.querySelectorAll("span, small, div, p, em, strong"),
  ).filter((node) => AD_BADGE.test((node.textContent || "").trim()));
  for (const badge of badgeNodes) {
    if (isHardSkipped(badge)) continue;
    slots.add(climbAdSlot(badge));
  }

  expandNearbyAdSlots(slots);
  collectRemoveAdsSlots(root, slots);
  collectIabSizedSlots(root, slots);
  return Array.from(slots);
}

function tightMediaSlot(media: Element): Element {
  const parent = media.parentElement;
  if (
    parent &&
    !isPageRoot(parent) &&
    wordCount(collectBlockText(parent)) <= 40
  ) {
    return parent;
  }
  return media;
}

/** Video players often keep the AD badge inside a cross-origin iframe. */
function expandNearbyAdSlots(slots: Set<Element>): void {
  const seeds = Array.from(slots);
  for (const slot of seeds) {
    const parents = [slot.parentElement, slot.parentElement?.parentElement];
    for (const parent of parents) {
      if (!parent || isPageRoot(parent)) continue;
      if (parent.tagName === "MAIN" || parent.tagName === "BODY") continue;
      for (const child of Array.from(parent.children)) {
        if (slots.has(child) || child === slot) continue;
        if (slot.contains(child) || child.contains(slot)) continue;
        if (isHardSkipped(child)) continue;
        if (
          looksLikeCtaCard(child) &&
          wordCount(collectBlockText(child)) <= 40
        ) {
          slots.add(child);
          continue;
        }
        if (!looksLikeMediaAdSlot(child)) continue;
        if (wordCount(collectBlockText(child)) <= 40) {
          slots.add(child);
          continue;
        }
        child.querySelectorAll("iframe, video").forEach((media) => {
          slots.add(tightMediaSlot(media));
        });
      }
    }
  }
}

const REMOVE_ADS_LABEL = /^remove ads$/i;

function collectRemoveAdsSlots(
  root: Document | Element,
  slots: Set<Element>,
): void {
  root.querySelectorAll("a, button, span, div").forEach((el) => {
    if (!REMOVE_ADS_LABEL.test((el.textContent || "").trim())) return;
    const prev = el.previousElementSibling;
    if (prev && !isHardSkipped(prev)) slots.add(prev);
  });
}

const IAB_SIZES = [
  [300, 250],
  [336, 280],
  [300, 600],
  [160, 600],
  [728, 90],
  [320, 50],
  [300, 169],
  [250, 250],
] as const;

function isIabSize(width: number, height: number): boolean {
  return IAB_SIZES.some(
    ([w, h]) => Math.abs(width - w) <= 20 && Math.abs(height - h) <= 20,
  );
}

function collectIabSizedSlots(
  root: Document | Element,
  slots: Set<Element>,
): void {
  root
    .querySelectorAll("iframe, video, ins, [id*='google_ads']")
    .forEach((el) => {
      if (isHardSkipped(el)) return;
      const rect = el.getBoundingClientRect();
      if (rect.width < 120 || rect.height < 40) return;
      if (!isIabSize(rect.width, rect.height)) return;
      slots.add(tightMediaSlot(el));
    });
}

export function blockIdFor(text: string, index: number): string {
  return `b${index}-${hashString(normalizeText(text)).slice(0, 10)}`;
}

function selectCandidates(root: Document | Element): Element[] {
  const ads = collectAdSlots(root);
  const content = Array.from(root.querySelectorAll(CONTENT_SELECTORS)).filter(
    (el) => {
      if (isSkipped(el)) return false;
      if (ads.some((ad) => el === ad || el.contains(ad) || ad.contains(el)))
        return false;
      const text = collectBlockText(el);
      return wordCount(text) >= minWordsFor(el) && wordCount(text) <= 800;
    },
  );

  const viableAds = ads.filter((el) => {
    if (isHardSkipped(el)) return false;
    return wordCount(collectBlockText(el)) >= minWordsFor(el);
  });

  return [...viableAds, ...keepOutermost(content)];
}

export function extractBlocks(
  root: Document | Element,
  options: { maxBlocks?: number; skipExisting?: boolean } = {},
): ExtractedBlock[] {
  const maxBlocks = options.maxBlocks ?? MAX_BLOCKS_PER_PAGE;
  const searchRoot = root instanceof Document ? root : root;
  const selected = selectCandidates(searchRoot).filter((el) => {
    if (options.skipExisting && el.getAttribute("data-jev-hidden") === "1")
      return false;
    return true;
  });

  return selected.slice(0, maxBlocks).map((el, index) => {
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
