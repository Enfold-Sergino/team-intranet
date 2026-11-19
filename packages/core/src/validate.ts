import type { Block, Item, SiteContent } from "./model";
import {
  blockSchemas,
  flattenIssues,
  formatIssuePath,
  isBlockType,
  isItemType,
  itemSchemas,
} from "./schemas";

/** Content the site leaves out, with enough detail for an editor to find it. */
export interface ContentProblem {
  /** Page path; for an item that isn't on a page, its own page or "(no page)". */
  page: string;
  kind: "unknown-block" | "invalid-block" | "invalid-item";
  /** What to look for in the CMS: `block "cards"` or `link item "Docs"`. */
  subject: string;
  id: string;
  /** Field that didn't match, e.g. "links[2].url"; null when the whole block is the problem. */
  field: string | null;
  message: string;
}

const count = (block: Block): number => block.children.reduce((n, c) => n + 1 + count(c), 0);
const hiddenInside = (block: Block) => {
  const n = count(block);
  if (!n) return "";
  return ` The ${n} block${n === 1 ? "" : "s"} inside it ${n === 1 ? "is" : "are"} hidden too.`;
};

/**
 * Every block and item the site leaves out: unknown block types, and blocks and items that don't
 * match their schema. One entry per field. Blocks inside a left-out block aren't checked separately.
 */
export function findInvalidContent(content: SiteContent): ContentProblem[] {
  const problems = new Map<string, ContentProblem>();
  const add = (p: ContentProblem) => {
    const key = `${p.id}|${p.field}`;
    if (!problems.has(key)) problems.set(key, p);
  };
  const pageOf = new Map(content.pages.map((p) => [p.id, p.path]));

  const checkBlock = (block: Block, page: string) => {
    const subject = `block "${block.type}"${block.name ? ` (${block.name})` : ""}`;
    if (!isBlockType(block.type)) {
      const message = `The site has no component for this block type, so it is left out.${hiddenInside(block)}`;
      add({ page, kind: "unknown-block", subject, id: block.id, field: null, message });
      return;
    }
    const result = blockSchemas[block.type].safeParse(block.props);
    if (!result.success) {
      for (const issue of flattenIssues(result.error.issues))
        add({
          page,
          kind: "invalid-block",
          subject,
          id: block.id,
          field: formatIssuePath(issue.path) || null,
          message: `${issue.message}. The block is left out.${hiddenInside(block)}`,
        });
      return;
    }
    block.children.forEach((child) => checkBlock(child, page));
  };

  const checkItem = (item: Item, page: string) => {
    if (!isItemType(item.type)) return;
    const result = itemSchemas[item.type].safeParse(item.data);
    if (result.success) return;
    for (const issue of flattenIssues(result.error.issues))
      add({
        page,
        kind: "invalid-item",
        subject: `${item.type} item "${item.title}"`,
        id: item.id,
        field: formatIssuePath(issue.path) || null,
        message: `${issue.message}. The item is left out wherever it is listed.`,
      });
  };

  for (const page of content.pages) {
    page.blocks.forEach((block) => checkBlock(block, page.path));
    if (page.primaryItem) checkItem(page.primaryItem, page.path);
  }
  for (const item of content.items)
    checkItem(item, (item.pageId && pageOf.get(item.pageId)) || "(no page)");
  return [...problems.values()];
}
