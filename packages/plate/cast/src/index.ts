/**
 * Plate rich text (CAST) → HAST, the core model's rich text. Plate's own converter
 * (@platecms/delta-cast-util-to-hast) does the work; around it, `prepare` makes CDA data safe for it
 * and `finish` fills in what it leaves out (code blocks, list start, images, site-relative links).
 */
import { toHast } from "@platecms/delta-cast-util-to-hast";
import { asUrl, type RichText } from "@team-intranet/core";
import type { Element, ElementContent, Root, RootContent } from "hast";

/** A CAST node, loosely typed: the CDA sends more shapes than @platecms/delta-cast describes. */
interface CastNode {
  type: string;
  value?: unknown;
  url?: string;
  prn?: string;
  ordered?: boolean;
  start?: number;
  children?: CastNode[];
}

/** Node types the converter handles; anything else is unwrapped to its children. */
const KNOWN = new Set([
  "root",
  "paragraph",
  "heading",
  "list",
  "listItem",
  "blockquote",
  "code",
  "text",
  "bold",
  "italic",
  "underline",
  "strikethrough",
  "highlight",
  "inlineCode",
  "contentValue",
  "externalLink",
  "internalLink",
]);
const IMAGE = /\.(png|jpe?g|gif|webp|avif|svg)(\?|#|$)/i;
const EMBED = "embed:";

const img = (src: string, alt: string): Element => ({
  type: "element",
  tagName: "img",
  properties: { src, alt, loading: "lazy" },
  children: [],
});

const textOf = (nodes: CastNode[] = []): string =>
  nodes.map((n) => (typeof n.value === "string" ? n.value : textOf(n.children))).join("");

/** Plate gives internal links as absolute channel URLs; the site needs its own paths. */
function sitePath(url: string | undefined): string | undefined {
  if (!url || !/^https?:/i.test(url)) return url;
  try {
    const { pathname, search, hash } = new URL(url);
    return IMAGE.test(pathname) ? url : `${pathname}${search}${hash}`;
  } catch {
    return url;
  }
}

/** One conversion: elements the converter can't produce are put in `embeds` and swapped in later. */
class Conversion {
  embeds: Element[] = [];
  listStarts: (number | undefined)[] = [];

  embed(element: Element): CastNode {
    this.embeds.push(element);
    return { type: "contentValue", prn: `${EMBED}${this.embeds.length - 1}` };
  }

  prepare(node: CastNode): CastNode[] {
    const children = () => (node.children ?? []).flatMap((child) => this.prepare(child));
    switch (node.type) {
      case "text":
        return [{ type: "text", value: String(node.value ?? "") }];
      case "inlineCode":
        return [{ type: "inlineCode", value: String(node.value ?? "") }];
      case "externalLink":
      case "internalLink": {
        const href = asUrl(node.type === "internalLink" ? sitePath(node.url) : node.url);
        if (!href) return children(); // unsafe or missing URL: keep the text
        // Plate links an uploaded image as an internal link to the file: show the image itself.
        if (node.type === "internalLink" && IMAGE.test(href))
          return [this.embed(img(href, textOf(node.children).replace(/\.[a-z0-9]+$/i, "")))];
        return [{ type: node.type, url: href, children: children() }];
      }
      case "contentValue": {
        const value = node.value as {
          type?: string;
          url?: string;
          mimeType?: string;
          altText?: string;
        };
        if (value?.type === "root") return [{ ...node, value: this.prepare(value as CastNode)[0] }];
        if (value?.url && value.mimeType?.startsWith("image/") && asUrl(value.url))
          return [this.embed(img(value.url, value.altText ?? ""))];
        if (typeof value === "string" || typeof value === "number")
          return [{ type: "text", value: String(value) }];
        return [];
      }
      case "list":
        this.listStarts.push(
          node.ordered && node.start && node.start !== 1 ? Number(node.start) : undefined,
        );
        return [{ ...node, children: children() }];
      default:
        return KNOWN.has(node.type) ? [{ ...node, children: children() }] : children();
    }
  }

  finish(nodes: RootContent[]): ElementContent[] {
    return nodes.flatMap((node): ElementContent[] => {
      if (node.type === "text") return node.value ? [node] : [];
      if (node.type !== "element") return [];
      // Lists were counted in document order: take this list's start before its nested lists'.
      const start =
        node.tagName === "ol" || node.tagName === "ul" ? this.listStarts.shift() : undefined;
      const children = this.finish(node.children);
      const { properties } = node;
      const prn = typeof properties.dataPrn === "string" ? properties.dataPrn : undefined;
      if (prn?.startsWith(EMBED)) return [this.embeds[Number(prn.slice(EMBED.length))]!];
      if (prn) return children; // an interpolated value: its content, without Plate's marker
      if (node.tagName === "a")
        return [{ ...node, properties: { href: properties.href }, children }];
      if (node.tagName === "ol" || node.tagName === "ul")
        return [{ ...node, properties: start ? { start } : {}, children }];
      if (node.tagName === "code" && "lang" in properties) {
        const lang = typeof properties.lang === "string" ? properties.lang : undefined;
        const code: Element = {
          ...node,
          properties: lang ? { className: [`language-${lang}`] } : {},
          children,
        };
        return [{ type: "element", tagName: "pre", properties: {}, children: [code] }];
      }
      return [{ ...node, children }];
    });
  }
}

/** Plate smart text (a CAST root, a list of nodes, or plain text) as HAST. */
export function castToHast(value: unknown): RichText {
  const root: CastNode =
    typeof value === "string"
      ? { type: "root", children: [{ type: "paragraph", children: [{ type: "text", value }] }] }
      : Array.isArray(value)
        ? { type: "root", children: value as CastNode[] }
        : value && typeof value === "object" && "type" in value
          ? (value as CastNode)
          : { type: "root", children: [] };
  const conversion = new Conversion();
  const prepared = conversion.prepare(
    root.type === "root" ? root : { type: "root", children: [root] },
  );
  const hast = toHast(prepared[0] ?? { type: "root", children: [] }) as Root;
  return { type: "root", children: conversion.finish(hast.children) as RootContent[] };
}
