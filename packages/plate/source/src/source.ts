import {
  createCdaClient,
  mapLimit,
  CdaRequestError,
  type CdaConfig,
  type CdaItem,
} from "@team-intranet/plate-connector";
import {
  itemSchemas,
  normalizePath,
  parentPath,
  withRoot,
  type ContentSource,
  type Language,
  type Page,
  type SiteContent,
} from "@team-intranet/core";
import { mapBlocks, mapItem, mapTags } from "./map";

export interface PlateSourceConfig extends CdaConfig {
  /**
   * Site language code → Plate language PRNs ({ "en-GB": [nl-BE, en-GB], "nl-NL": [nl-NL] }). Items
   * are then loaded per language and get that locale; without it every item is shared.
   */
  itemLanguages?: Readonly<Record<string, readonly string[]>>;
  /** Item types listed on their own (link directory, settings). Default: every type in core. */
  itemTypes?: readonly string[];
  /**
   * Plate editors often create the homepage at "/home" instead of the channel root. For each
   * language root without a page, the page at `homePath` under it is served there instead.
   */
  homePath?: string;
  languages?: readonly Language[];
  /** Pages fetched at the same time (default 6): fast, without tripping the rate limit. */
  concurrency?: number;
}

/** PLATE_LANGUAGE_PRNS="en-GB=<prn>|<prn>;nl-NL=<prn>" → { "en-GB": [...], "nl-NL": [...] }. */
export function parseItemLanguages(
  value: string | undefined,
): Record<string, string[]> | undefined {
  const out: Record<string, string[]> = {};
  for (const part of value?.split(";") ?? []) {
    const [code, prns = ""] = part.split("=");
    if (code?.trim())
      out[code.trim()] = prns
        .split("|")
        .map((p) => p.trim())
        .filter(Boolean);
  }
  return Object.keys(out).length ? out : undefined;
}

/** The source configured from environment variables (see .env.example). */
export const plateConfigFromEnv = (
  env: Record<string, string | undefined>,
  languages?: readonly Language[],
): PlateSourceConfig => ({
  token: env.PLATE_DELIVERY_TOKEN ?? "",
  baseUrl: env.PLATE_CDA_URL || undefined,
  itemLanguages: parseItemLanguages(env.PLATE_LANGUAGE_PRNS),
  homePath: env.PLATE_HOME_PATH || "/home",
  languages,
});

/** Two pages on one path would overwrite each other: fail the build instead. */
export function assertUniquePaths(pages: Pick<Page, "path" | "title">[]): void {
  const seen = new Map<string, string>();
  for (const { path, title } of pages) {
    const other = seen.get(path);
    if (other !== undefined)
      throw new Error(`Two pages resolve to "${path}": "${other}" and "${title}"`);
    seen.set(path, title);
  }
}

/** Serves each language's `homePath` page at the language root (when the root has no page). */
export function useHomeAlias(
  content: SiteContent,
  homePath: string,
  languages: readonly Language[],
): SiteContent {
  const moved = new Map<Page, string>();
  const redirects: Record<string, string> = {};
  for (const language of languages) {
    if (content.pages.some((p) => p.path === language.root)) continue;
    const from = withRoot(homePath, language);
    const home = content.pages.find((p) => p.path === from);
    if (!home) continue;
    moved.set(home, language.root);
    redirects[from] = language.root;
  }
  if (!moved.size) return content;
  return {
    ...content,
    redirects: { ...content.redirects, ...redirects },
    pages: content.pages.map((p) =>
      moved.has(p) ? { ...p, path: moved.get(p)!, parentTreeId: null } : p,
    ),
  };
}

export function createPlateSource(config: PlateSourceConfig): ContentSource {
  return {
    async load(): Promise<SiteContent> {
      const client = createCdaClient(config);
      const itemTypes = config.itemTypes ?? Object.keys(itemSchemas);

      // Items per language (first language wins for an item in several), or all at once.
      const locales = new Map<string, string>();
      const loadItems = async (): Promise<CdaItem[]> => {
        const languages = Object.entries(config.itemLanguages ?? {}).filter(
          ([, prns]) => prns.length,
        );
        if (!languages.length) return client.items();
        const items: CdaItem[] = [];
        for (const [code, prns] of languages)
          for (const item of await client.items(prns))
            if (!locales.has(item.prn)) {
              locales.set(item.prn, code);
              items.push(item);
            }
        return items;
      };
      const [paths, rawItems] = await Promise.all([client.paths(), loadItems()]);
      const deps = new Map(rawItems.map((item) => [item.prn, item]));

      const gone: string[] = [];
      const loaded = await mapLimit(
        paths,
        config.concurrency ?? 6,
        async (path): Promise<Page | null> => {
          const raw = await client.experience(path);
          if (!raw) {
            gone.push(path); // unpublished between listing and fetching
            return null;
          }
          const at = normalizePath(raw.path ?? path);
          const primary = raw.primaryContentItemPrn
            ? deps.get(raw.primaryContentItemPrn)
            : undefined;
          return {
            id: raw.prn,
            path: at,
            treeId: at,
            parentTreeId: parentPath(at),
            title: raw.title,
            seoTitle: raw.seoTitle,
            description: raw.seoDescription,
            tags: mapTags(raw.tags),
            updatedAt: raw.updatedAt,
            publishedAt: raw.lastPublished,
            primaryItem: primary ? mapItem(primary, deps) : null,
            blocks: mapBlocks(raw.experienceComponent, deps),
          };
        },
      );
      const pages = loaded.filter((p): p is Page => p !== null);
      if (gone.length)
        console.warn(
          `[plate] ${gone.length} listed page(s) returned 404 and were skipped: ${gone.sort().join(", ")}`,
        );
      if (!pages.length)
        throw new CdaRequestError("The CDA returned no published pages for this channel");
      assertUniquePaths(pages);

      const content: SiteContent = {
        pages,
        items: rawItems
          .filter((item) => itemTypes.includes(item.contentTypeSlug))
          .map((item) => mapItem(item, deps, locales.get(item.prn) ?? null)),
        fetchedAt: new Date().toISOString(),
        redirects: {},
      };
      return config.languages && config.homePath
        ? useHomeAlias(content, config.homePath, config.languages)
        : content;
    },
  };
}
