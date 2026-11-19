import { blockSchemas, findInvalidContent, type SiteContent } from "@team-intranet/core";
import type { CdaItem } from "@team-intranet/plate-connector";
import { describe, expect, it } from "vitest";
import { mapBlocks, mapItem, mapTag, mapTags, toCamelCase } from "../src";

const v = (valueType: string, value: unknown) => ({ valueType, value });
const castRoot = {
  type: "root",
  children: [{ type: "paragraph", children: [{ type: "text", value: "Hi" }] }],
};

describe("mapBlocks", () => {
  const hero = {
    prn: "prn:hero",
    name: "Welcome",
    buildingBlockSlug: "hero",
    content: {
      title: v("STRING", "Welcome"),
      intro: v("SMART_TEXT", castRoot),
      image: v("ASSET", { prn: "a", url: "https://cdn.test/a.png", altText: "Office" }),
      "cta-label": v("STRING", "Go"),
      "cta-link": v("PATH_PART", { prn: "pp", path: "team/" }),
    },
  };

  it("drops Plate's root and maps every value type to the core shapes", () => {
    const [block] = mapBlocks(
      { prn: "root", buildingBlockSlug: "root", components: [hero] },
      new Map(),
    );
    expect(block).toMatchObject({ id: "prn:hero", type: "hero", name: "Welcome", children: [] });
    expect(block!.props).toEqual({
      title: "Welcome",
      intro: {
        type: "root",
        children: [
          {
            type: "element",
            tagName: "p",
            properties: {},
            children: [{ type: "text", value: "Hi" }],
          },
        ],
      },
      image: { url: "https://cdn.test/a.png", alt: "Office" },
      ctaLabel: "Go",
      ctaLink: { id: "pp", path: "/team" },
    });
    expect(blockSchemas.hero.safeParse(block!.props).success).toBe(true);
  });

  it("resolves linked items, also inside lists", () => {
    const person: CdaItem = {
      prn: "p1",
      contentTypeSlug: "person",
      displayName: "Noor",
      primaryContentExperiencePrn: null,
      content: { name: v("STRING", "Noor"), photo: v("ASSET", { url: null }) },
    };
    const [block] = mapBlocks(
      {
        prn: "t",
        buildingBlockSlug: "team-list",
        content: {
          people: [v("CONTENT_ITEM", { prn: "p1" }), v("CONTENT_ITEM", { prn: "missing" })],
        },
      },
      new Map([["p1", person]]),
    );
    expect(block!.props.people).toEqual([{ name: "Noor", photo: { url: null, alt: null } }, null]);
    expect(blockSchemas["team-list"].parse(block!.props).people).toEqual([
      { name: "Noor", role: null, email: null, photo: null },
    ]);
  });
});

describe("mapItem", () => {
  it("maps an item and passes core validation", () => {
    const link: CdaItem = {
      prn: "l1",
      contentTypeSlug: "link",
      displayName: "Docs",
      primaryContentExperiencePrn: "page1",
      tags: ["prn:tag"],
      content: {
        title: v("STRING", "Docs"),
        url: v("STRING", "https://docs.test"),
        category: v("TAG", { prn: "c", name: "Tools" }),
      },
    };
    const item = mapItem(link, new Map(), "en-GB");
    expect(item).toMatchObject({
      id: "l1",
      type: "link",
      title: "Docs",
      locale: "en-GB",
      pageId: "page1",
    });
    expect(item.data.category).toMatchObject({ id: "c", name: "Tools" });
    const content: SiteContent = { pages: [], items: [item], fetchedAt: "", redirects: {} };
    expect(findInvalidContent(content)).toEqual([]);
  });
});

describe("tags", () => {
  it("accepts PRN strings and objects", () => {
    expect(
      mapTags(["prn:1", { prn: "prn:2", path: "Client/APG", color: "#f00" }, null, 3]),
    ).toEqual([
      { id: "prn:1", name: null, path: null, color: null },
      { id: "prn:2", name: "APG", path: "Client/APG", color: "#f00", ancestorIds: [] },
    ]);
    expect(mapTags(undefined)).toEqual([]);
  });

  it("collects ancestors from prnPath (list or string) and parentPrn, without the tag itself", () => {
    expect(
      mapTag({ prn: "c", name: "C", prnPath: ["a", "b", "c"], parentPrn: "b" })?.ancestorIds,
    ).toEqual(["a", "b"]);
    expect(mapTag({ prn: "c", name: "C", prnPath: "a/b/c" })?.ancestorIds).toEqual(["a", "b"]);
  });
});

it("camelCases field slugs like delta-client", () => {
  expect(toCamelCase("cta-link")).toBe("ctaLink");
  expect(toCamelCase("Primary_navigation")).toBe("primaryNavigation");
});
