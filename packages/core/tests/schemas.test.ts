import { describe, expect, it } from "vitest";
import { blockSchemas, findInvalidContent, itemData, parseBlockProps } from "../src";
import { block, content, item, page } from "./fixtures";

describe("block schemas", () => {
  it("normalises values to what the components render", () => {
    const props = blockSchemas.hero.parse({
      title: "  Welcome  ",
      intro: { type: "root", children: [] },
      image: { url: null, alt: "pending upload" },
      ctaLabel: "",
      ctaLink: { id: "p", path: "" },
    });
    expect(props).toEqual({
      title: "Welcome",
      intro: { type: "root", children: [] },
      image: null,
      ctaLabel: null,
      ctaLink: { id: "p", path: "/" },
    });
  });

  it("treats missing fields as empty and a single value as a list of one", () => {
    expect(blockSchemas.gallery.parse({ images: { url: "/a.png" } })).toEqual({
      title: null,
      columns: null,
      images: [{ url: "/a.png", alt: null }],
    });
    expect(blockSchemas.table.parse({ content: ["a | b", null, "  "] }).content).toEqual(["a | b"]);
  });

  it("drops unsafe link URLs inside items", () => {
    const { cards } = blockSchemas.cards.parse({
      cards: [
        { title: "A", link: "javascript:alert(1)" },
        { title: "B", link: "https://example.com" },
      ],
    });
    expect(cards.map((card) => card.link)).toEqual([null, "https://example.com"]);
  });

  it("rejects rich text that isn't HAST", () => {
    expect(blockSchemas.content.safeParse({ content: { type: "paragraph" } }).success).toBe(false);
  });

  it("reports which field doesn't match", () => {
    const parsed = parseBlockProps(block("callout", { tone: "danger", title: 42 }));
    expect(parsed.ok).toBe(false);
    expect(!parsed.ok && parsed.error).toMatch(/tone: .*title: /);
  });

  it("keeps the raw props of blocks without a schema", () => {
    expect(parseBlockProps(block("unknown", { a: 1 }))).toEqual({ ok: true, props: { a: 1 } });
  });
});

describe("item data", () => {
  it("returns typed data for the requested type only", () => {
    expect(
      itemData(item("project", { title: "Apollo", status: "active" }), "project")?.status,
    ).toBe("active");
    expect(itemData(item("person", { name: "Noor" }), "project")).toBeNull();
  });
});

describe("findInvalidContent", () => {
  it("lists every invalid block and item", () => {
    const home = page("/", {
      blocks: [
        block("section", { columns: "two" }, [block("cards", { columns: "x" })]),
        { ...block("not-in-contract"), name: "Old banner" },
      ],
    });
    expect(findInvalidContent(content([home], [item("link", { title: "Docs", url: 7 })]))).toEqual([
      {
        page: "/",
        kind: "invalid-block",
        subject: 'block "section"',
        id: "id:section",
        field: "columns",
        message: expect.stringMatching(/left out\. The 1 block inside it is hidden too\.$/),
      },
      {
        page: "/",
        kind: "unknown-block",
        subject: 'block "not-in-contract" (Old banner)',
        id: "id:not-in-contract",
        field: null,
        message: expect.stringContaining("no component"),
      },
      {
        page: "(no page)",
        kind: "invalid-item",
        subject: 'link item "link"',
        id: "id:link",
        field: "url",
        message: expect.stringContaining("left out wherever it is listed"),
      },
    ]);
  });

  it("names the field inside a list and the item's own page", () => {
    const apollo = page("/projects/apollo", {
      id: "apollo",
      blocks: [block("quick-links", { links: [{ title: "A", url: "/a" }, { title: 3 }] })],
    });
    const project = item("project", { title: "Apollo", status: "paused" }, { pageId: "apollo" });
    expect(findInvalidContent(content([apollo], [project])).map((p) => [p.page, p.field])).toEqual([
      ["/projects/apollo", "links[1].title"],
      ["/projects/apollo", "status"],
    ]);
  });
});
