/** Small normalisers shared by the schemas, the site helpers and the adapters. */

/** Trimmed text; anything else, or only whitespace, becomes null. */
export const asString = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;

/**
 * A URL that is safe in an href: http(s), mailto and tel links, site paths and anchors. Anything else
 * (javascript:, data:, protocol-relative //host or /\host, bare words) becomes null.
 */
export function asUrl(value: unknown): string | null {
  const url = asString(value);
  // Browsers treat a backslash like a slash, so /\evil.com is the protocol-relative //evil.com.
  if (!url || /^[/\\]{2}/.test(url)) return null;
  return /^(https?:|mailto:|tel:|\/|#)/i.test(url) ? url : null;
}

/** "/a//b/" → "/a/b"; "" → "/". */
export function normalizePath(path: string | null | undefined): string {
  const trimmed = (path ?? "").trim().replace(/\/+/g, "/").replace(/\/$/, "");
  if (!trimmed) return "/";
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

/** "/a/b" → "/a"; "/a" → "/"; "/" → null. */
export function parentPath(path: string): string | null {
  if (path === "/") return null;
  return path.split("/").slice(0, -1).join("/") || "/";
}

/** Title order with numbers compared as numbers: "Lesson 2" before "Lesson 10". */
export const compareTitles = (a: string, b: string) =>
  a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
