/**
 * The Plate theme snapshot (delta/): building blocks and content types as the Delta CLI fetches
 * them. Plain TypeScript without imports, so scripts/sync.ts can run it with Node directly.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export interface Rule {
  ruleType: string;
  settings: Record<string, unknown>;
}
export interface Field {
  slug: string;
  title: string;
  contentValidationRules: Rule[];
}
export interface BuildingBlock {
  slug: string;
  title: string;
  buildingBlockFields: Field[];
}
export interface ContentType {
  slug: string;
  name: string;
  contentFields: Field[];
}
export interface Theme {
  blocks: BuildingBlock[];
  contentTypes: ContentType[];
}

/** Item types the site lists on their own (kept in step with core's itemSchemas by a test). */
export const ITEM_TYPES = [
  "card",
  "link",
  "person",
  "procedure",
  "procedure-step",
  "project",
  "site-settings",
];

/** The CLI fetches at most this many content types. */
const CLI_CONTENT_TYPE_LIMIT = 10;

/** The snapshot in `dir` (delta/). */
export function readTheme(dir: string): Theme {
  const read = <T>(sub: string): T[] => {
    const path = join(dir, sub);
    try {
      return readdirSync(path)
        .filter((f) => f.endsWith(".json"))
        .sort()
        .map((f) => JSON.parse(readFileSync(join(path, f), "utf8")) as T);
    } catch {
      return [];
    }
  };
  return { blocks: read("building-blocks"), contentTypes: read("content-types") };
}

/** "cta-link" → "ctaLink": how field slugs become props. */
export const toCamelCase = (slug: string) =>
  slug
    .split(/[-_ ]+/)
    .filter(Boolean)
    .map((part, i) =>
      i === 0 ? part.toLowerCase() : part[0]!.toUpperCase() + part.slice(1).toLowerCase(),
    )
    .join("");

type Raw = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any -- CLI output

const linkedTypes = (field: Field) =>
  field.contentValidationRules.flatMap((rule) =>
    rule.ruleType === "RELATABLE_CONTENT_TYPES"
      ? ((rule.settings.allowedContentTypes as string[] | undefined) ?? [])
      : [],
  );

/**
 * Check and clean what the Delta CLI (0.2.11) fetched. It links content types by PRN instead of
 * slug, and returns the organisation's 10 newest content types rather than the theme's. So: PRNs
 * become slugs, only the item types and the types they link to are kept, timestamps and PRNs are
 * dropped (they change on every sync), and a theme with anything missing is refused.
 */
export function prepareTheme(fetched: {
  blocks: Raw[];
  contentTypes: Raw[];
}): Theme | { errors: string[] } {
  const errors: string[] = [];
  if (!fetched.blocks.length)
    errors.push("The CLI returned no building blocks. Check PLATE_THEME_PRN and the profile.");
  const slugByPrn = new Map(
    fetched.contentTypes.filter((t) => t.prn).map((t) => [t.prn as string, t.slug as string]),
  );
  const typesBySlug = new Map(fetched.contentTypes.map((t) => [t.slug as string, t]));

  const field = (owner: string, raw: Raw): Field => ({
    slug: raw.slug,
    title: raw.title ?? raw.name ?? raw.slug,
    contentValidationRules: ((raw.contentValidationRules ?? []) as Raw[]).map((rule) => {
      const settings = { ...(rule.settings ?? {}) };
      if (rule.ruleType === "RELATABLE_CONTENT_TYPES")
        settings.allowedContentTypes = ((settings.allowedContentTypes ?? []) as string[]).flatMap(
          (value) => {
            if (!value.startsWith("prn:")) return [value];
            const slug = slugByPrn.get(value);
            if (!slug)
              errors.push(
                `${owner}.${raw.slug} links to content type ${value}, which the CLI didn't return.`,
              );
            return slug ? [slug] : [];
          },
        );
      return { ruleType: rule.ruleType, settings };
    }),
  });

  const seen = new Set<string>();
  const blocks = fetched.blocks.map((raw): BuildingBlock => {
    if (seen.has(raw.slug)) errors.push(`Building block ${raw.slug} appears twice.`);
    seen.add(raw.slug);
    return {
      slug: raw.slug,
      title: raw.title ?? raw.slug,
      buildingBlockFields: ((raw.buildingBlockFields ?? []) as Raw[]).map((f) =>
        field(raw.slug, f),
      ),
    };
  });

  const keep = new Map<string, ContentType>();
  const missing = new Set<string>();
  const visit = (slug: string, from: string) => {
    if (keep.has(slug)) return;
    const raw = typesBySlug.get(slug);
    if (!raw) return void missing.add(`${slug} (${from})`);
    const type: ContentType = {
      slug,
      name: raw.name ?? slug,
      contentFields: ((raw.contentFields ?? []) as Raw[]).map((f) => field(slug, f)),
    };
    keep.set(slug, type);
    for (const f of type.contentFields)
      for (const linked of linkedTypes(f)) visit(linked, `linked from ${slug}.${f.slug}`);
  };
  for (const slug of ITEM_TYPES) visit(slug, "listed by the site");
  for (const block of blocks)
    for (const f of block.buildingBlockFields)
      for (const linked of linkedTypes(f)) visit(linked, `linked from ${block.slug}.${f.slug}`);

  if (missing.size) {
    errors.push(`Content types missing from the CLI output: ${[...missing].join(", ")}.`);
    if (fetched.contentTypes.length >= CLI_CONTENT_TYPE_LIMIT)
      errors.push(
        `The CLI returned ${fetched.contentTypes.length} content types, its limit: the missing ones were probably cut off.`,
      );
  }
  if (errors.length) return { errors: [...new Set(errors)] };
  const bySlug = (a: { slug: string }, b: { slug: string }) => a.slug.localeCompare(b.slug);
  return { blocks: blocks.sort(bySlug), contentTypes: [...keep.values()].sort(bySlug) };
}

/** Slugs added, removed and changed, per kind. */
export function diffTheme(before: Theme, after: Theme) {
  const diff = (old: { slug: string }[], now: { slug: string }[]) => {
    const a = new Map(old.map((x) => [x.slug, JSON.stringify(x)]));
    const b = new Map(now.map((x) => [x.slug, JSON.stringify(x)]));
    return {
      added: [...b.keys()].filter((s) => !a.has(s)),
      removed: [...a.keys()].filter((s) => !b.has(s)),
      changed: [...b.keys()].filter((s) => a.has(s) && a.get(s) !== b.get(s)),
    };
  };
  return {
    blocks: diff(before.blocks, after.blocks),
    contentTypes: diff(before.contentTypes, after.contentTypes),
  };
}
