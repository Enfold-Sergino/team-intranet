import type { Block, Item, Page, SiteContent } from "../src";
import { parseLanguages } from "../src";

export const languages = parseLanguages("en-GB:EN:English:/,nl-NL:NL:Nederlands:/nl");
export const en = languages.find((l) => l.code === "en-GB")!;
export const nl = languages.find((l) => l.code === "nl-NL")!;

export const block = (
  type: string,
  props: Record<string, unknown> = {},
  children: Block[] = [],
): Block => ({
  id: `id:${type}`,
  type,
  name: null,
  props,
  children,
});

export const item = (
  type: string,
  data: Record<string, unknown> = {},
  extra: Partial<Item> = {},
): Item => ({
  id: `id:${type}`,
  type,
  title: type,
  tags: [],
  locale: null,
  pageId: null,
  data,
  ...extra,
});

/** A page whose tree parent is its parent path, unless `parentTreeId` is given. */
export const page = (path: string, extra: Partial<Page> = {}): Page => ({
  id: `id:${path}`,
  path,
  treeId: path,
  parentTreeId: path === "/" ? null : path.split("/").slice(0, -1).join("/") || "/",
  title: path === "/" ? "Home" : path.split("/").pop()!,
  seoTitle: null,
  description: null,
  tags: [],
  updatedAt: null,
  publishedAt: null,
  primaryItem: null,
  blocks: [],
  ...extra,
});

export const content = (pages: Page[], items: Item[] = []): SiteContent => ({
  pages,
  items,
  fetchedAt: "2026-01-01T00:00:00.000Z",
  redirects: {},
});
