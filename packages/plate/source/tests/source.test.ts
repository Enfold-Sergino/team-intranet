// The source against a fake CDA. All data is invented: this repository is public.
import { parseLanguages, type SiteContent } from "@team-intranet/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  assertUniquePaths,
  createPlateSource,
  parseItemLanguages,
  plateConfigFromEnv,
  useHomeAlias,
  type PlateSourceConfig,
} from "../src";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const experience = (path: string, extra: object = {}) => ({
  prn: `prn:${path}`,
  title: `Page ${path}`,
  path,
  experienceComponent: { prn: `root:${path}`, buildingBlockSlug: "root", components: [] },
  ...extra,
});
const link = (prn: string, title: string) => ({
  prn,
  contentTypeSlug: "link",
  displayName: title,
  content: { title: { value: title, valueType: "STRING" } },
});

function load(
  paths: string[],
  items: (url: URL) => object[] = () => [],
  extra: Partial<PlateSourceConfig> = {},
) {
  const fetch = vi.fn(async (input: string | URL | Request) => {
    const url = new URL(String(input));
    if (url.pathname === "/v1/sitemap.xml") return new Response("<urlset></urlset>");
    if (url.pathname === "/v0/content-experiences")
      return json({
        data: paths.map((path, i) => ({ cursor: `c${i}`, node: { pathPart: { path } } })),
      });
    if (url.pathname === "/v1/content-items")
      return json({ entities: items(url), meta: { pagination: { totalPages: 1 } } });
    const path = url.pathname.replace("/v1/content-experiences/path", "");
    return path !== "/gone" ? json(experience(path)) : json({}, 404);
  });
  const source = createPlateSource({
    token: "t",
    fetch: fetch as unknown as typeof globalThis.fetch,
    sleep: async () => {},
    ...extra,
  });
  return source.load();
}

afterEach(() => vi.restoreAllMocks());

describe("createPlateSource", () => {
  it("loads pages as core pages and skips pages that are gone", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const content = await load(["/", "/projects", "/projects/alpha", "/gone"]);
    expect(content.pages.map((p) => [p.path, p.parentTreeId]).sort()).toEqual([
      ["/", null],
      ["/projects", "/"],
      ["/projects/alpha", "/projects"],
    ]);
    expect(content.pages[0]).toMatchObject({ id: "prn:/", title: "Page /", blocks: [] });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("/gone"));
  });

  it("loads items per language and marks their locale", async () => {
    const content = await load(
      ["/"],
      (url) =>
        url.searchParams.get("languagePrn_in") === "prn:lang:nl"
          ? [link("nl", "Kantoor")]
          : [link("en", "Office"), link("nl", "Kantoor")],
      { itemLanguages: { "en-GB": ["prn:lang:en"], "nl-NL": ["prn:lang:nl"] } },
    );
    expect(content.items.map((i) => [i.id, i.locale])).toEqual([
      ["en", "en-GB"],
      ["nl", "en-GB"], // first language wins
    ]);
  });

  it("keeps only the configured item types", async () => {
    const other = { prn: "x", contentTypeSlug: "unrelated" };
    const content = await load(["/"], () => [link("l", "Docs"), other]);
    expect(content.items.map((i) => i.type)).toEqual(["link"]);
  });

  it("serves /home at the root when the root has no page", async () => {
    const languages = parseLanguages("en-GB:EN:English:/,nl-NL:NL:Nederlands:/nl");
    const content = await load(["/home", "/team"], () => [], { homePath: "/home", languages });
    expect(content.pages.map((p) => p.path).sort()).toEqual(["/", "/team"]);
    expect(content.redirects).toEqual({ "/home": "/" });
  });

  it("fails without pages", async () => {
    await expect(load([])).rejects.toThrow(/no published pages/);
  });
});

describe("helpers", () => {
  it("parses PLATE_LANGUAGE_PRNS", () => {
    expect(parseItemLanguages("en-GB=prn:a|prn:b; nl-NL=prn:c")).toEqual({
      "en-GB": ["prn:a", "prn:b"],
      "nl-NL": ["prn:c"],
    });
    expect(parseItemLanguages("")).toBeUndefined();
    expect(plateConfigFromEnv({ PLATE_DELIVERY_TOKEN: "t" })).toMatchObject({
      token: "t",
      homePath: "/home",
    });
  });

  it("refuses two pages on one path", () => {
    expect(() =>
      assertUniquePaths([
        { path: "/a", title: "A" },
        { path: "/a", title: "B" },
      ]),
    ).toThrow(/"\/a"/);
  });

  it("aliases each language's home and leaves roots with a page alone", () => {
    const languages = parseLanguages("en-GB:EN:English:/,nl-NL:NL:Nederlands:/nl");
    const page = (path: string) => ({
      id: path,
      path,
      treeId: path,
      parentTreeId: null,
      title: path,
      seoTitle: null,
      description: null,
      tags: [],
      updatedAt: null,
      publishedAt: null,
      primaryItem: null,
      blocks: [],
    });
    const content = (...paths: string[]): SiteContent => ({
      pages: paths.map(page),
      items: [],
      fetchedAt: "",
      redirects: {},
    });
    const both = useHomeAlias(content("/home", "/team", "/nl/home"), "/home", languages);
    expect(both.pages.map((p) => p.path)).toEqual(["/", "/team", "/nl"]);
    expect(both.redirects).toEqual({ "/home": "/", "/nl/home": "/nl" });
    expect(useHomeAlias(content("/", "/home"), "/home", languages).redirects).toEqual({});
  });
});
