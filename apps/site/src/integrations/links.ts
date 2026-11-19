/** Finding broken internal links in the built HTML. */

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&quot;": '"',
  "&#39;": "'",
  "&lt;": "<",
  "&gt;": ">",
};
const decode = (value: string) => value.replace(/&(?:amp|quot|#39|lt|gt);/g, (e) => ENTITIES[e]!);

/** Every href, src, srcset URL and meta-refresh target (our own output, so a regex is enough). */
export function extractUrls(html: string): string[] {
  const urls: string[] = [];
  for (const m of html.matchAll(/\s(?:href|src)=(["'])(.*?)\1/gi)) urls.push(decode(m[2]!));
  for (const m of html.matchAll(/\ssrcset=(["'])(.*?)\1/gi))
    for (const candidate of m[2]!.split(","))
      if (candidate.trim()) urls.push(decode(candidate.trim().split(/\s+/)[0]!));
  for (const m of html.matchAll(
    /<meta[^>]+http-equiv=["']refresh["'][^>]+content=["']\d+;\s*url=([^"']+)/gi,
  ))
    urls.push(decode(m[1]!));
  return urls;
}

/** "projects/x/index.html" → "/projects/x/". */
export function pageUrl(file: string): string {
  const path = `/${file.replace(/\\/g, "/")}`;
  return path.endsWith("/index.html") ? path.slice(0, -"index.html".length) : path;
}

/** The files that serve `path` in a "directory" build. */
export function candidates(path: string): string[] {
  const clean = path.replace(/^\/+/, "");
  return clean === "" || clean.endsWith("/")
    ? [`${clean}index.html`]
    : [clean, `${clean}/index.html`, `${clean}.html`];
}

export type LinkProblem = { kind: "missing-base" | "broken"; target: string };

/**
 * One URL found on `page` (a site path without base): null when fine. A root-relative URL without
 * the base is a code bug ("missing-base"); a link to a path that isn't built is "broken". External,
 * mail, tel and hash links are not checked.
 */
export function checkUrl(
  url: string,
  page: string,
  opts: { base: string; exists: (path: string) => boolean },
): LinkProblem | null {
  const trimmed = url.trim();
  if (
    !trimmed ||
    trimmed.startsWith("#") ||
    /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ||
    /^[/\\]{2}/.test(trimmed)
  )
    return null;
  const prefix = opts.base.replace(/\/+$/, "");
  let absolute: string;
  if (trimmed.startsWith("/")) {
    if (prefix && trimmed !== prefix && !trimmed.startsWith(`${prefix}/`))
      return { kind: "missing-base", target: trimmed };
    absolute = trimmed.slice(prefix.length) || "/";
  } else absolute = new URL(trimmed, `https://site.invalid${page}`).pathname;
  let path = absolute.split(/[?#]/)[0]!;
  try {
    path = decodeURI(path);
  } catch {
    return { kind: "broken", target: trimmed };
  }
  return opts.exists(path) ? null : { kind: "broken", target: trimmed };
}
