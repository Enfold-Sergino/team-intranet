/** Full-text search over a page index, small enough to run in the browser. */

export interface SearchPage {
  url: string;
  title: string;
  text: string;
}

export interface SearchResult extends Omit<SearchPage, "text"> {
  snippet: string;
  score: number;
}

/** Lowercase, accents removed: "Café" matches "cafe". */
export const fold = (value: string) => value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

export const terms = (query: string) => [...new Set(fold(query).split(/\s+/).filter(Boolean))];

const count = (haystack: string, needle: string) => {
  let n = 0;
  for (let i = haystack.indexOf(needle); i !== -1; i = haystack.indexOf(needle, i + needle.length))
    n++;
  return n;
};

/** Text around the first match, cut at word boundaries. */
export function snippet(text: string, words: string[], length = 180): string {
  const folded = fold(text);
  const first = Math.min(...words.map((w) => folded.indexOf(w)).filter((i) => i >= 0));
  if (!Number.isFinite(first)) return text.slice(0, length);
  let start = Math.max(0, first - Math.floor(length / 3));
  if (start > 0) start = text.indexOf(" ", start) + 1 || start;
  let end = Math.min(text.length, start + length);
  if (end < text.length && text.lastIndexOf(" ", end) > start) end = text.lastIndexOf(" ", end);
  return `${start > 0 ? "…" : ""}${text.slice(start, end).trim()}${end < text.length ? "…" : ""}`;
}

/** Pages containing every term. Title hits weigh most; ties keep the index order. */
export function search(pages: SearchPage[], query: string, limit = 50): SearchResult[] {
  const words = terms(query);
  if (!words.length) return [];
  const results: SearchResult[] = [];
  for (const page of pages) {
    const title = fold(page.title);
    const text = fold(page.text);
    let score = 0;
    const all = words.every((word) => {
      const inTitle = count(title, word);
      const inText = count(text, word);
      score += inTitle * 10 + Math.min(inText, 10) + (title.startsWith(word) ? 5 : 0);
      return inTitle > 0 || inText > 0;
    });
    if (all)
      results.push({ url: page.url, title: page.title, snippet: snippet(page.text, words), score });
  }
  return results.sort((a, b) => b.score - a.score).slice(0, limit);
}
