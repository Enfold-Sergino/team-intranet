// The live editor's renderer: the site's Astro components through Astro's internal runtime. If an
// Astro upgrade changes that runtime, this test fails before the preview breaks in the editor.
import { describe, expect, it } from "vitest";
import { demoSource } from "../src/content/demo";
import { siteOptions } from "../src/content/options";
import { previewContent } from "../src/preview/data";
import { renderPage } from "../src/preview/render";

const content = previewContent(await demoSource.load());
const options = siteOptions({});

describe("live editor preview", () => {
  it("renders a draft with the site's components, marking blocks for selection", async () => {
    const published = content.pages.find(
      (p) => p.path === "/procedure-overview/onboarding/accounts",
    )!;
    const draft = {
      ...published,
      primaryItem: null,
      blocks: [
        {
          id: "b1",
          type: "content",
          name: null,
          editorId: "placement-1",
          props: { title: "Draft <title>", content: null },
          children: [],
        },
      ],
    };
    const html = await renderPage(draft, content, options);
    expect(html).toContain('data-editor-id="placement-1"');
    expect(html).toContain("Draft &lt;title&gt;");
    // The published primary item and the reading order still apply.
    expect(html).toMatch(/rel="next"/);
  });

  it("keeps only what the preview needs of other pages", () => {
    const about = content.pages.find((p) => p.path === "/about")!;
    expect(about.blocks.map((b) => b.type)).toEqual(["content"]);
  });
});
