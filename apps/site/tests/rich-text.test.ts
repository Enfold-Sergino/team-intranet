import type { RichText } from "@team-intranet/core";
import { describe, expect, it } from "vitest";
import { renderRichText } from "../src/lib/rich-text";
import { prefixBase } from "../src/lib/url";

const el = (tagName: string, properties: Record<string, unknown>, ...children: object[]) => ({
  type: "element",
  tagName,
  properties,
  children,
});
const text = (value: string) => ({ type: "text", value });
const tree = (...children: object[]) => ({ type: "root", children }) as RichText;

describe("renderRichText", () => {
  it("removes what a CMS must not inject", () => {
    const html = renderRichText(
      tree(
        el("p", { onclick: "x()" }, text("hi")),
        el("script", {}, text("alert(1)")),
        el("a", { href: "javascript:alert(1)" }, text("x")),
      ),
    );
    expect(html).toBe("<p>hi</p><a>x</a>");
  });

  it("shifts headings and clamps them", () => {
    expect(
      renderRichText(tree(el("h1", {}, text("T")), el("h6", {}, text("U"))), { headingOffset: 1 }),
    ).toBe("<h2>T</h2><h6>U</h6>");
  });

  it("opens external links in a new tab and lazy-loads images", () => {
    expect(
      renderRichText(
        tree(
          el("a", { href: "https://x.test" }, text("x")),
          el("a", { href: "/team" }, text("t")),
          el("img", { src: "https://cdn.test/a.png", alt: "A" }),
        ),
      ),
    ).toBe(
      '<a href="https://x.test" target="_blank" rel="noopener noreferrer">x</a><a href="/team">t</a><img src="https://cdn.test/a.png" alt="A" loading="lazy">',
    );
  });

  it("keeps code languages and list numbering", () => {
    expect(
      renderRichText(
        tree(
          el("pre", {}, el("code", { className: ["language-ts"] }, text("a"))),
          el("ol", { start: 3 }, el("li", {}, text("c"))),
        ),
      ),
    ).toBe('<pre><code class="language-ts">a</code></pre><ol start="3"><li>c</li></ol>');
    expect(renderRichText(null)).toBe("");
  });
});

describe("prefixBase", () => {
  it.each([
    ["/team", "/repo/", "/repo/team"],
    ["/repo/team", "/repo/", "/repo/team"],
    ["/team", "/", "/team"],
    ["https://x.test/a", "/repo/", "https://x.test/a"],
    ["//cdn.test/a", "/repo/", "//cdn.test/a"],
    ["#top", "/repo/", "#top"],
  ])("%s under %s → %s", (url, base, expected) => expect(prefixBase(url, base)).toBe(expected));
});
