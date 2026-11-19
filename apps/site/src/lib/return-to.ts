/**
 * Where the login page may send the visitor after signing in: a page of this site (same origin,
 * under `base`), never the login page itself. Anything else goes to the homepage, so `?returnTo=`
 * can't bounce people to another site (`//evil.com` and `/\evil.com` alike).
 */
export function safeReturnTo(value: string | null, base: string, origin: string): string {
  if (!value || !value.startsWith("/") || /^[/\\]{2}/.test(value)) return base;
  let url: URL;
  try {
    url = new URL(value, origin);
  } catch {
    return base;
  }
  if (
    url.origin !== origin ||
    !url.pathname.startsWith(base) ||
    url.pathname.startsWith(`${base}login`)
  )
    return base;
  return url.pathname + url.search + url.hash;
}
