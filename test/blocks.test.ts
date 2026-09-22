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

    document.querySelectorAll("[data-jev-id]").forEach((el) => {
      el.setAttribute("data-jev-hidden", "1");
    });
    const second = extractBlocks(document, { skipExisting: true });
    expect(second).toEqual([]);
  });

  test("finds native AD-badge banners and iframe slots inside a huge section", () => {
    document.documentElement.innerHTML = `
      <section class="home-layout">
        <h1>Play online chess and solve puzzles with friends every day of the week</h1>
        <p>
          Start a game, play bots, play coach, play a friend, review a game,
          and prevent castling while you check the chess lifeline. This wrapper
          is long enough that the old extractor would keep only this section.
        </p>
        <div class="board-layout-ad">
          <span>AD</span>
          <p>Switch Funds To Medibank. Switching health funds is easy. Learn More</p>
        </div>
        <div class="video-rail">
          <span>AD</span>
          <p>KORUU</p>
          <iframe title="KORUU ad" src="https://googleads.g.doubleclick.net/pagead/ads?x=1"></iframe>
        </div>
      </section>
    `;

    const blocks = extractBlocks(document);
    const text = blocks.map((block) => block.text).join("\n");
    expect(text).toMatch(/Medibank/i);
    expect(text).toMatch(/KORUU/i);
    expect(text).toMatch(/labeled AD/i);
    expect(blocks.length).toBeGreaterThanOrEqual(2);
    expect(blocks.every((block) => block.tagName !== "section")).toBe(true);
  });

  test("picks up a sibling video slot whose AD badge is inside the iframe", () => {
    document.documentElement.innerHTML = `
      <div class="home-bottom">
        <div class="board-layout-ad">
          <span>AD</span>
          <p>Switch Funds To Medibank. Switching health funds is easy. Learn More</p>
        </div>
        <div class="video-cell">
          <iframe title="KORUU" src="https://player.example.com/vast/clip"></iframe>
          <button>Learn More</button>
        </div>
      </div>
    `;

    const blocks = extractBlocks(document);
    const text = blocks.map((block) => block.text).join("\n");
    expect(text).toMatch(/Medibank/i);
    expect(text).toMatch(/video or iframe advertisement/i);
    expect(blocks.length).toBeGreaterThanOrEqual(2);
  });

  test("treats the unit above a Remove Ads control as an ad slot", () => {
    document.documentElement.innerHTML = `
      <div class="right-rail">
        <div class="daily-puzzle">Daily puzzle about a knight fork that is not an advertisement.</div>
        <div class="amazon-slot">
          <img alt="Amazon CFDs" />
          <iframe title="capital.com" src="https://player.example.com/cfd"></iframe>
        </div>
        <button type="button">Remove Ads</button>
      </div>
    `;

    const blocks = extractBlocks(document);
    const text = blocks.map((block) => block.text).join("\n");
    expect(text).toMatch(
      /Amazon CFDs|capital\.com|video or iframe advertisement/i,
    );
    expect(blocks.some((block) => /daily puzzle/i.test(block.text))).toBe(
      false,
    );
  });
});
