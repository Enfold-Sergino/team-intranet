/**
 * The published site as the live editor preview needs it (dist/editor/site.json): every page's
 * path, title, tags and primary item, plus the items, so overviews, link lists and previous/next in
 * a draft show real pages. Other pages' blocks are left out, except the two kinds the preview reads.
 * The content is encrypted like the pages on protected builds (src/integrations); options are not.
 */
import type { Page, SiteContent, SiteOptions } from "@team-intranet/core";

/** `content`: overview cards fall back to a page's first text. `procedure-steps`: reading order. */
const KEPT = new Set(["content", "procedure-steps"]);

export interface PreviewData {
  options: SiteOptions;
  content: SiteContent;
}

export const previewContent = (content: SiteContent): SiteContent => ({
  ...content,
  pages: content.pages.map((page): Page => ({
    ...page,
    blocks: page.blocks.filter((b) => KEPT.has(b.type)).map((b) => ({ ...b, children: [] })),
  })),
});
