import { extractBlocks } from "../src/lib/blocks";

const FIXTURE = `
<!doctype html>
<html>
  <body>
    <nav>
      Home About Contact Pricing Blog Careers and more navigation chrome that should stay visible.
    </nav>
    <header>Site Title and a marketing strapline that is chrome, not a content block.</header>
    <main>
      <article>
        <h1>A long editorial article about cooking beans at home</h1>
        <p>
          Dried beans need a soak, a simmer, and a pinch of salt at the end.
          This piece walks through soaking times, why hard water matters, and
          how a bay leaf changes the pot. None of this is an advertisement.
          Readers who cook weekly can use the same pot for chickpeas, lentils,
          and black beans without buying a gadget. The method is slow on
          purpose so the skins stay intact and the broth tastes like food
          instead of a can. Leftovers keep for three days and freeze well.
        </p>
      </article>
      <aside class="ad-card" id="ad-sidebar">
        Sponsored: Book this vacation package today and save on flights.
        Limited offer for new customers. Click through to our partner.
        <img alt="Paid vacation promotion" />
      </aside>
    </main>
    <footer>Copyright 2026 Example Media. All rights reserved for the publisher.</footer>
  </body>
</html>
`;

describe("block extraction", () => {
  test("keeps the article and ad card, skips nav/header/footer", () => {
    document.documentElement.innerHTML = FIXTURE;
    const blocks = extractBlocks(document);

    const tags = blocks.map((block) => block.tagName);
    expect(tags).toContain("article");
    expect(tags).toContain("aside");
    expect(tags).not.toContain("nav");
    expect(tags).not.toContain("header");
    expect(tags).not.toContain("footer");

    const ad = blocks.find((block) => block.tagName === "aside");
    expect(ad?.text).toMatch(/Sponsored|vacation|Paid vacation/i);

    const article = blocks.find((block) => block.tagName === "article");
    expect(article?.text).toMatch(/cooking beans/i);
    expect(article?.text.length).toBeGreaterThan(40);
  });

  test("assigns stable data-jev-id attributes and can skip existing nodes", () => {
    document.documentElement.innerHTML = FIXTURE;
    const first = extractBlocks(document);
    expect(first.length).toBeGreaterThan(0);
    const marked = document.querySelectorAll("[data-jev-id]").length;
    expect(marked).toBe(first.length);

    const second = extractBlocks(document, { skipExisting: true });
    expect(second).toEqual([]);
  });
});
