/**
 * Rich text (HAST) → HTML. Sanitized first (content comes from a CMS), then adapted to the site:
 * headings shifted below the page title, site paths prefixed with the base, external links in a
 * new tab, images lazy-loaded.
 */
import type { RichText } from "@team-intranet/core";
import type { Element, Root, RootContent } from "hast";
import { defaultSchema, sanitize } from "hast-util-sanitize";
import { toHtml } from "hast-util-to-html";
import { isExternal, withBase } from "./url";

const HEADING = /^h([1-6])$/;

function adapt(node: RootContent, headingOffset: number): RootContent {
  if (node.type !== "element") return node;
  const children = node.children.map((child) => adapt(child, headingOffset)) as Element["children"];
  const properties = { ...node.properties };
  let tagName = node.tagName;
  const level = HEADING.exec(tagName)?.[1];
  if (level) tagName = `h${Math.min(6, Math.max(1, Number(level) + headingOffset))}`;
  if (tagName === "a" && typeof properties.href === "string") {
    properties.href = withBase(properties.href);
    if (isExternal(properties.href))
      Object.assign(properties, { target: "_blank", rel: "noopener noreferrer" });
  }
  if (tagName === "img") {
    if (typeof properties.src === "string") properties.src = withBase(properties.src);
    properties.loading = "lazy";
  }
  return { ...node, tagName, properties, children };
}

export function renderRichText(
  tree: RichText | null | undefined,
  { headingOffset = 0 } = {},
): string {
  if (!tree) return "";
  const clean = sanitize(tree, defaultSchema) as Root;
  return toHtml({ ...clean, children: clean.children.map((child) => adapt(child, headingOffset)) });
}
