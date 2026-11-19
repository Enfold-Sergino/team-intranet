/**
 * The content model every CMS adapter produces and the site renders. CMS-agnostic: ids are opaque
 * strings, rich text is HAST (the standard HTML syntax tree), and nothing here names a CMS.
 */
import type { Root } from "hast";

/** Rich text as a HAST tree. Adapters convert their own format (CAST, Portable Text, …) to it. */
export type RichText = Root;

export interface Asset {
  url: string;
  alt: string | null;
}

export interface Tag {
  id: string;
  name: string | null;
  /** Hierarchical name path, e.g. "Client/APG" (group = first segment). */
  path: string | null;
  color: string | null;
  /** Ids of the parent tags (nearest last), when the CMS provides them. */
  ancestorIds?: string[];
}

/** A link to a page: its id when known, and its path. */
export interface PageRef {
  id: string | null;
  path: string;
}

/** A content item (a link, a person, a project, …): typed data reusable on several pages. */
export interface Item<TData = Record<string, unknown>> {
  id: string;
  type: string;
  title: string;
  tags: Tag[];
  /** Site language code (e.g. "nl-NL"); null when the item is shared by every language. */
  locale: string | null;
  /** Id of the page built around this item, if any. */
  pageId: string | null;
  data: TData;
}

/** One block on a page: `type` selects the component, `props` are validated by its schema. */
export interface Block {
  id: string;
  type: string;
  /** Editor-facing name, shown in content reports. */
  name: string | null;
  props: Record<string, unknown>;
  children: Block[];
}

export interface Page {
  id: string;
  /** Route path: starts with "/", no trailing slash (root = "/"). */
  path: string;
  /** Node id in the page tree; differs from `path` only when a page is served elsewhere (alias). */
  treeId: string;
  /** `treeId` of the parent; null for top-level pages. */
  parentTreeId: string | null;
  title: string;
  seoTitle: string | null;
  description: string | null;
  tags: Tag[];
  updatedAt: string | null;
  publishedAt: string | null;
  /** The item this page is about (a project page → its project item). */
  primaryItem: Item | null;
  blocks: Block[];
}

export interface SiteContent {
  pages: Page[];
  items: Item[];
  /** When the content was loaded (ISO). */
  fetchedAt: string;
  /** Old path → new path, rendered as redirect pages. */
  redirects: Record<string, string>;
}

/** What a CMS adapter implements. */
export interface ContentSource {
  load(): Promise<SiteContent>;
}
