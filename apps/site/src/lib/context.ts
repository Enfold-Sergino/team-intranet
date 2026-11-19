import type { Page, Site } from "@team-intranet/core";

/** Passed to every block, so data-driven blocks (overviews, links) can read the site. */
export interface RenderContext {
  /** The site in the page's language. */
  site: Site;
  page: Page;
  /** Development: blocks that can't render show why instead of disappearing. */
  dev: boolean;
  /** Rendered inside a CMS's live editor (phase 5). */
  editor?: boolean;
}

/** Where a block sits: lets `content` render its title as the page h1, and sections nest as cards. */
export interface Placement {
  depth: number;
  index: number;
  isPageTitle: boolean;
}
