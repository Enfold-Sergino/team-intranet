/** One search entry per rendered page: its h1 and the text of its <main>. */
import type { SearchPage } from "@team-intranet/core";

/** Body text kept per page: enough for matching and snippets, small enough to download. */
export const MAX_TEXT = 4000;

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  "#39": "'",
  nbsp: " ",
};
const decode = (value: string) =>
  value.replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (entity, name: string) =>
    name[0] === "#"
      ? String.fromCodePoint(
          /^#x/i.test(name) ? parseInt(name.slice(2), 16) : Number(name.slice(1)),
        )
      : (ENTITIES[name.toLowerCase()] ?? entity),
  );

const textOf = (html: string) =>
  decode(
    html
      .replace(/<(script|style|template|noscript)\b[\s\S]*?<\/\1>/gi, " ")
      .replace(/<nav\b[\s\S]*?<\/nav>/gi, " ") // breadcrumbs and pagers repeat on every page
      // A tag, also when a quoted attribute contains ">" (Tailwind classes like [&_li>p]:my-0).
      .replace(/<(?:[^>"']|"[^"]*"|'[^']*')*>/g, " "),
  )
    .replace(/\s+/g, " ")
    .trim();

/** Null for pages that shouldn't be found: redirects and pages without a <main>. */
export function searchEntry(html: string, url: string): SearchPage | null {
  if (/<meta[^>]+http-equiv=["']refresh["']/i.test(html)) return null;
  const main = /<main\b[^>]*>([\s\S]*?)<\/main>/i.exec(html)?.[1];
  if (main === undefined) return null;
  const h1 = /<h1\b[^>]*>([\s\S]*?)<\/h1>/i.exec(main)?.[1];
  const title =
    (h1 && textOf(h1)) || textOf(/<title>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? "") || url;
  return { url, title, text: textOf(main).slice(0, MAX_TEXT) };
}
