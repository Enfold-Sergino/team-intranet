import { toHtml } from "hast-util-to-html";
import { describe, expect, it } from "vitest";
import { castToHast } from "../src";

const text = (value: string) => ({ type: "text", value });
const para = (...children: object[]) => ({
  type: "root",
  children: [{ type: "paragraph", children }],
});
const html = (value: unknown) => toHtml(castToHast(value));

describe("castToHast", () => {
  it("converts formatting with Plate's converter", () => {
    expect(html(para(text("Hi "), { type: "bold", children: [text("there")] }))).toBe(
      "<p>Hi <strong>there</strong></p>",
    );
    expect(html(para(text("a\nb")))).toBe("<p>a<br>b</p>");
  });

  it("accepts plain text and node lists", () => {
    expect(html("<b>x</b>")).toBe("<p>&#x3C;b>x&#x3C;/b></p>");
    expect(html([{ type: "paragraph", children: [text("x")] }])).toBe("<p>x</p>");
    expect(html(null)).toBe("");
  });

  it.each(["javascript:alert(1)", " JavaScript:alert(1)", "data:text/html,x", "//evil.test"])(
    "drops unsafe link %s but keeps the text",
    (url) =>
      expect(html(para({ type: "externalLink", url, children: [text("click")] }))).toBe(
        "<p>click</p>",
      ),
  );

  it("keeps safe links, without Plate's target", () => {
    expect(
      html(
        para({
          type: "externalLink",
          url: "https://x.test",
          target: "blank",
          children: [text("x")],
        }),
      ),
    ).toBe('<p><a href="https://x.test">x</a></p>');
  });

  it("turns internal links into site paths", () => {
    const link = {
      type: "internalLink",
      prn: "p",
      url: "https://channel.test/team/office?a=1#b",
      children: [text("x")],
    };
    expect(html(para(link))).toBe('<p><a href="/team/office?a=1#b">x</a></p>');
  });

  it("shows an image linked as an internal link", () => {
    const link = {
      type: "internalLink",
      prn: "a",
      url: "https://cdn.test/photo.png",
      children: [text("Team photo.png")],
    };
    expect(html(para(link))).toBe(
      '<p><img src="https://cdn.test/photo.png" alt="Team photo" loading="lazy"></p>',
    );
  });

  it("renders image values and the content of interpolated values", () => {
    expect(
      html({
        type: "contentValue",
        prn: "v",
        value: { url: "https://cdn.test/a.png", mimeType: "image/png", altText: "A" },
      }),
    ).toBe('<img src="https://cdn.test/a.png" alt="A" loading="lazy">');
    expect(html(para({ type: "contentValue", prn: "v", value: para(text("inline")) }))).toBe(
      "<p>inline</p>",
    );
  });

  it("makes code blocks and keeps list numbering", () => {
    expect(
      html({ type: "root", children: [{ type: "code", lang: "ts", children: [text("a < b")] }] }),
    ).toBe('<pre><code class="language-ts">a &#x3C; b</code></pre>');
    const item = (t: string) => ({
      type: "listItem",
      children: [{ type: "paragraph", children: [text(t)] }],
    });
    const list = {
      type: "list",
      ordered: true,
      start: 3,
      children: [item("c"), { type: "list", ordered: false, children: [item("x")] }],
    };
    expect(html({ type: "root", children: [list] })).toBe(
      '<ol start="3"><li><p>c</p></li><ul><li><p>x</p></li></ul></ol>',
    );
  });

  it("drops suggestions and unwraps unknown nodes", () => {
    expect(
      html(
        para(
          { type: "castSuggestion", original: [] },
          { type: "mystery", children: [text("kept")] },
        ),
      ),
    ).toBe("<p>kept</p>");
  });
});
