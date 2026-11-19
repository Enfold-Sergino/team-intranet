/**
 * The block and item contract. Every CMS adapter must deliver these fields (camelCase); its theme
 * check verifies that the CMS models cover them. Components get their types from here.
 */
import { z } from "zod";
import type { Block, Item } from "./model";
import { asset, date, many, number, one, oneOf, pageRef, richText, tag, text, url } from "./values";

const card = z.object({
  title: one(text),
  image: one(asset),
  body: one(richText),
  link: one(url),
});

const link = z.object({
  title: one(text),
  url: one(url),
  description: one(text),
  category: one(tag),
});

const person = z.object({
  name: one(text),
  role: one(text),
  email: one(text),
  photo: one(asset),
});

const procedureStep = z.object({
  title: one(text),
  body: one(richText),
});

const procedure = z.object({
  title: one(text),
  summary: one(text),
  category: one(tag),
  owner: one(person),
  lastReviewed: one(date),
  steps: many(procedureStep),
});

const project = z.object({
  title: one(text),
  summary: one(text),
  client: one(text),
  status: one(oneOf(["planned", "active", "on-hold", "done"])),
  startDate: one(date),
  endDate: one(date),
  coverImage: one(asset),
  team: many(person),
  repositoryUrl: one(url),
  links: many(link),
});

const siteSettings = z.object({
  siteName: one(text),
  logo: one(asset),
  primaryNavigation: many(pageRef),
  footerText: one(text),
});

/** Item data by item type. */
export const itemSchemas = {
  card,
  link,
  person,
  procedure,
  "procedure-step": procedureStep,
  project,
  "site-settings": siteSettings,
};

/** Props by block type. */
export const blockSchemas = {
  callout: z.object({
    tone: one(oneOf(["info", "warning", "success"])),
    title: one(text),
    body: one(richText),
  }),
  cards: z.object({ title: one(text), columns: one(number), cards: many(card) }),
  content: z.object({ title: one(text), content: one(richText) }),
  "experience-list": z.object({
    title: one(text),
    parent: one(pageRef),
    contentType: one(text),
    view: one(text),
    limit: one(number),
    tag: one(tag),
  }),
  gallery: z.object({ title: one(text), images: many(asset), columns: one(number) }),
  hero: z.object({
    title: one(text),
    intro: one(richText),
    image: one(asset),
    ctaLabel: one(text),
    ctaLink: one(pageRef),
  }),
  image: z.object({ image: one(asset), altText: one(text) }),
  "link-directory": z.object({ title: one(text), tag: one(tag) }),
  "procedure-steps": z.object({ procedure: one(procedure) }),
  "quick-links": z.object({ title: one(text), links: many(link) }),
  section: z.object({ title: one(text), intro: one(text), columns: one(number) }),
  table: z.object({ header: one(text), content: many(text) }),
  "team-list": z.object({ title: one(text), people: many(person) }),
};

export type ItemType = keyof typeof itemSchemas;
export type ItemData<T extends ItemType> = z.output<(typeof itemSchemas)[T]>;
export type BlockType = keyof typeof blockSchemas;
export type BlockProps<T extends BlockType> = z.output<(typeof blockSchemas)[T]>;

export const isBlockType = (type: string): type is BlockType => Object.hasOwn(blockSchemas, type);
export const isItemType = (type: string): type is ItemType => Object.hasOwn(itemSchemas, type);

export type ParsedProps =
  { ok: true; props: Record<string, unknown> } | { ok: false; error: string };

/** A block's props parsed with its schema. Blocks without a schema keep their raw props. */
export function parseBlockProps(block: Block): ParsedProps {
  if (!isBlockType(block.type)) return { ok: true, props: block.props };
  const result = blockSchemas[block.type].safeParse(block.props);
  return result.success
    ? { ok: true, props: { ...block.props, ...result.data } }
    : { ok: false, error: describeIssues(result.error) };
}

/** Typed data of `item` when it is of type `type` and valid; otherwise null. */
export function itemData<T extends ItemType>(
  item: Item | null | undefined,
  type: T,
): ItemData<T> | null {
  if (!item || item.type !== type) return null;
  const result = itemSchemas[type].safeParse(item.data);
  return result.success ? (result.data as ItemData<T>) : null;
}

type Issue = z.core.$ZodIssue;

/** "links[1].title" */
export const formatIssuePath = (path: readonly PropertyKey[]): string =>
  path
    .map((p) => (typeof p === "number" ? `[${p}]` : `.${String(p)}`))
    .join("")
    .replace(/^\./, "");

const depth = (issues: Issue[]) => Math.max(0, ...issues.map((issue) => issue.path.length));

/**
 * The issues of an error with union failures unwrapped: "one link or a list of links" is a union,
 * and keeping the branch that got furthest names the actual field ("links[1].title").
 */
export function flattenIssues(issues: readonly Issue[], prefix: PropertyKey[] = []): Issue[] {
  return issues.flatMap((issue): Issue[] => {
    const path = [...prefix, ...issue.path];
    if (issue.code === "invalid_union" && issue.errors.length) {
      const best = issue.errors.reduce((a, b) => (depth(b) > depth(a) ? b : a));
      if (best.length) return flattenIssues(best, path);
    }
    return [{ ...issue, path }];
  });
}

/** "tone: Invalid option; title: expected string" (at most `max` issues). */
export function describeIssues(error: z.ZodError, max = 5): string {
  const issues = flattenIssues(error.issues);
  const shown = issues
    .slice(0, max)
    .map(
      (issue) => `${issue.path.length ? `${formatIssuePath(issue.path)}: ` : ""}${issue.message}`,
    );
  return shown.join("; ") + (issues.length > max ? ` (+${issues.length - max} more)` : "");
}
