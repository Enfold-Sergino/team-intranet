// Pages rendered with the Astro container, from the invented demo content.
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { createSite, parseLanguages, type Block } from "@team-intranet/core";
import { beforeAll, describe, expect, it } from "vitest";
import PageView from "../src/components/page/PageView.astro";
import { fileNameForType, typeFromFileName } from "../src/components/page/registry";
import { demoSource } from "../src/content/demo";

const languages = parseLanguages("en-GB:EN:English:/,nl-NL:NL:Nederlands:/nl");
const site = createSite(await demoSource.load(), {
  languages,
  sequenceSections: ["/procedure-overview"],
});
let container: AstroContainer;
beforeAll(async () => {
  container = await AstroContainer.create();
});
const render = (path: string, extra: { dev?: boolean; blocks?: Block[] } = {}) => {
  const page = site.page(path)!;
  return container.renderToString(PageView, {
    props: {
      page: extra.blocks ? { ...page, blocks: extra.blocks } : page,
      site: site.forLanguage(languages[1]!),
      dev: extra.dev ?? false,
    },
  });
};
const count = (html: string, re: RegExp) => html.match(re)?.length ?? 0;

describe("PageView", () => {
  it("renders exactly one h1, from the first content block's title", async () => {
    const html = await render("/about");
    expect(count(html, /<h1[ >]/g)).toBe(1);
    expect(html).toMatch(/<h1[^>]*>About us<\/h1>/);
  });

  it("adds the page title when no block renders one", async () => {
    const html = await render("/projects");
    expect(html).toMatch(/<h1[^>]*>Projects<\/h1>/);
    expect(html).toContain("Apollo");
  });

  it("lists the child pages of a page without content", async () => {
    expect(await render("/procedure-overview")).toContain("Onboarding");
  });

  it("links procedure pages in reading order", async () => {
    const html = await render("/procedure-overview/onboarding/accounts");
    expect(html).toContain('aria-label="Pages in this section"');
    expect(html).toMatch(/href="\/procedure-overview\/onboarding\/tools" rel="next"/);
  });

  it("leaves out blocks that can't render, except in development", async () => {
    const blocks: Block[] = [
      { id: "x", type: "mystery", name: null, props: {}, children: [] },
      { id: "y", type: "callout", name: null, props: { tone: "loud" }, children: [] },
    ];
    const published = await render("/about", { blocks });
    expect(published).not.toContain("mystery");
    expect(published).not.toContain('role="note"');
    const dev = await render("/about", { blocks, dev: true });
    expect(dev).toContain("MysteryBlock.astro");
    expect(dev).toContain("doesn't match its schema");
  });
});

describe("block registry", () => {
  it("maps file names to block types and back", () => {
    expect(typeFromFileName("../../blocks/ExperienceListBlock.astro")).toBe("experience-list");
    expect(typeFromFileName("notABlock.astro")).toBeNull();
    expect(fileNameForType("experience-list")).toBe("ExperienceListBlock.astro");
  });
});
