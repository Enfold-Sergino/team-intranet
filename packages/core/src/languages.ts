/**
 * Site languages. Each language has a root path: the default language at "/", the others under their
 * own root ("/nl"). A page's language follows from its path.
 */
export interface Language {
  /** BCP 47 code, used for <html lang> and hreflang. */
  code: string;
  /** Short label in the switcher, e.g. "EN". */
  label: string;
  /** Name in the language itself, e.g. "Nederlands". */
  name: string;
  /** "/" or "/nl". */
  root: string;
}

/** "en-GB:EN:English:/,nl-NL:NL:Nederlands:/nl" (code:label:name:root), longest root first. */
export function parseLanguages(value: string): Language[] {
  const languages = value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [code = "", label = "", name = "", root = "/"] = entry.split(":").map((s) => s.trim());
      return {
        code,
        label: label || code.toUpperCase(),
        name: name || code,
        root: `/${root.replace(/^\/+|\/+$/g, "")}`,
      };
    })
    .filter((language) => language.code);
  if (!languages.length) throw new Error(`No languages in "${value}"`);
  // Longest root first, so "/nl" wins over "/" when matching paths.
  return languages.sort((a, b) => b.root.length - a.root.length);
}

const inRoot = (path: string, root: string) =>
  root === "/" || path === root || path.startsWith(`${root}/`);

/** The language whose root is "/" (else the first). */
export const defaultLanguage = (languages: Language[]): Language =>
  languages.find((l) => l.root === "/") ?? languages[0]!;

/** The language a path belongs to (longest matching root). */
export const languageOf = (path: string, languages: Language[]): Language =>
  languages.find((l) => inRoot(path, l.root)) ?? defaultLanguage(languages);

/** "/nl/team" in nl-NL → "/team". */
export const stripRoot = (path: string, language: Language): string =>
  language.root === "/" ? path : path.slice(language.root.length) || "/";

/** "/team" in nl-NL → "/nl/team". */
export function withRoot(path: string, language: Language): string {
  if (language.root === "/") return path;
  return path === "/" ? language.root : `${language.root}${path}`;
}

/** The same path under another language's root. */
export const translatePath = (path: string, to: Language, languages: Language[]): string =>
  withRoot(stripRoot(path, languageOf(path, languages)), to);
