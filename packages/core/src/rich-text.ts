/** Reading rich text (HAST) without rendering it: plain text, excerpts, emptiness. */
import type { RichText } from "./model";

type Node = { type: string; value?: unknown; tagName?: string; children?: Node[] };

const BLOCKS = new Set(["p", "h1", "h2", "h3", "h4", "h5", "h6", "li", "blockquote", "pre", "tr"]);

/** Plain text; block elements are separated by a space. */
export function toText(tree: RichText | null | undefined): string {
  const walk = (node: Node): string => {
    if (node.type === "text") return String(node.value ?? "");
    const inner = (node.children ?? []).map(walk).join("");
    return node.tagName && BLOCKS.has(node.tagName) ? ` ${inner} ` : inner;
  };
  return tree
    ? walk(tree as Node)
        .replace(/\s+/g, " ")
        .trim()
    : "";
}

/** The first `max` characters of the text, cut at a word boundary; null when there is no text. */
export function excerpt(tree: RichText | null | undefined, max = 160): string | null {
  const text = toText(tree);
  if (!text) return null;
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const end = cut.lastIndexOf(" ") > max * 0.6 ? cut.lastIndexOf(" ") : max;
  return `${cut.slice(0, end).replace(/[\s,.;:]+$/, "")}…`;
}

/** Does the tree contain an element with this tag name? */
export function hasElement(tree: RichText | null | undefined, tagName: string): boolean {
  const walk = (node: Node): boolean =>
    node.tagName === tagName || (node.children ?? []).some(walk);
  return Boolean(tree) && walk(tree as Node);
}

/** No text and no image. */
export const isEmpty = (tree: RichText | null | undefined) =>
  !toText(tree) && !hasElement(tree, "img");
