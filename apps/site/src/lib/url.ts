/**
 * Base path handling. The site may be served under a sub-path (SITE_BASE, e.g. /intranet/), while content
 * links to root paths like "/projects/x". Every rendered href and src goes through `withBase`.
 */

/** Prefix a root-relative URL with `base`. External, protocol-relative, hash and relative URLs pass. */
export function prefixBase<T extends string | null | undefined>(url: T, base: string): T {
  if (typeof url !== "string") return url;
  const prefix = base.replace(/\/+$/, "");
  if (!prefix || !url.startsWith("/") || /^[/\\]{2}/.test(url)) return url;
  if (url === prefix || url.startsWith(`${prefix}/`)) return url;
  return `${prefix}${url}` as T;
}

export const withBase = <T extends string | null | undefined>(url: T): T =>
  prefixBase(url, import.meta.env.BASE_URL ?? "/");

export const isExternal = (url: string) => /^https?:/i.test(url);
