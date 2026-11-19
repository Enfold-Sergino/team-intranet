import { asUrl } from "./text";

/**
 * A table row typed as text: cells separated by "|". A line without "|" may use tabs or ";" instead
 * (handy when typing in a CMS); a ";" in a "|"-separated row stays text.
 */
export const splitRow = (line: string): string[] =>
  (line.includes("|") ? line.split(/\s*\|\s*/) : line.split(/\s*(?:\t|;)\s*/)).map((c) => c.trim());

export type CellPart = { text: string } | { text: string; href: string; external: boolean };

/** Cell text with Markdown-style links: "See [the policy](/p-o/policies)". Unsafe URLs stay text. */
export function cellParts(cell: string): CellPart[] {
  const parts: CellPart[] = [];
  let last = 0;
  for (const m of cell.matchAll(/\[([^\]]+)\]\(([^)\s]+)\)/g)) {
    if (m.index > last) parts.push({ text: cell.slice(last, m.index) });
    const href = asUrl(m[2]);
    parts.push(href ? { text: m[1]!, href, external: /^https?:/i.test(href) } : { text: m[0] });
    last = m.index + m[0].length;
  }
  if (last < cell.length) parts.push({ text: cell.slice(last) });
  return parts;
}
