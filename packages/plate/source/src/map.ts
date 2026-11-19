/**
 * Plate's "accessible" format → the core model. Every field value carries its Plate value type, so
 * each one is mapped exactly: smart text to HAST, assets, path parts and tags to their core shapes,
 * and linked content items to their (mapped) data. Field slugs become camelCase props.
 */
import { ContentValueTypeNames as T } from "@platecms/delta-client/graphql";
import type { CdaComponent, CdaContent, CdaItem, CdaValue } from "@team-intranet/plate-connector";
import { castToHast } from "@team-intranet/plate-cast";
import { normalizePath, type Block, type Item, type Tag } from "@team-intranet/core";

/** Linked items by PRN: the CDA sends a linked item as `{ prn }` only. */
export type Dependencies = ReadonlyMap<string, CdaItem>;

/** "cta-link" → "ctaLink" (the rule delta-client's parsers use). */
export const toCamelCase = (slug: string) =>
  slug
    .split(/[-_ ]+/)
    .filter(Boolean)
    .map((part, i) =>
      i === 0 ? part.toLowerCase() : part[0]!.toUpperCase() + part.slice(1).toLowerCase(),
    )
    .join("");

const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : {};
const str = (value: unknown) => (typeof value === "string" && value ? value : null);

/** A tag as a PRN string or an object (name, path, color, prnPath, parentPrn). */
export function mapTag(raw: unknown): Tag | null {
  if (typeof raw === "string") return { id: raw, name: null, path: null, color: null };
  const t = record(raw);
  if (typeof t.prn !== "string") return null;
  const path = str(t.path);
  // prnPath: a list or a "/"-separated string of PRNs, root first, the tag itself last.
  const prnPath = Array.isArray(t.prnPath)
    ? t.prnPath.filter((p): p is string => typeof p === "string")
    : typeof t.prnPath === "string"
      ? t.prnPath.split("/").filter(Boolean)
      : [];
  const ancestors = [...prnPath, ...(typeof t.parentPrn === "string" ? [t.parentPrn] : [])];
  return {
    id: t.prn,
    name: str(t.name) ?? path?.split("/").pop() ?? null,
    path,
    color: str(t.color),
    ancestorIds: [...new Set(ancestors.filter((p) => p !== t.prn))],
  };
}

export const mapTags = (raw: unknown): Tag[] =>
  Array.isArray(raw) ? raw.map(mapTag).filter((tag): tag is Tag => tag !== null) : [];

function mapValue({ value, valueType }: CdaValue, deps: Dependencies, depth: number): unknown {
  switch (valueType) {
    case T.SmartText:
      return castToHast(value);
    case T.Asset: {
      const asset = record(value);
      return { url: str(asset.url), alt: str(asset.altText) };
    }
    case T.PathPart: {
      const part = record(value);
      return { id: str(part.prn), path: normalizePath(str(part.path)) };
    }
    case T.Tag:
      return mapTag(value);
    case T.ContentItem:
      return itemData(value as CdaItem, deps, depth + 1);
    default:
      return value;
  }
}

/** Field values by camelCase slug; a list field stays a list. */
export function mapContent(content: CdaContent | null | undefined, deps: Dependencies, depth = 0) {
  return Object.fromEntries(
    Object.entries(content ?? {}).map(([slug, v]) => [
      toCamelCase(slug),
      Array.isArray(v) ? v.map((each) => mapValue(each, deps, depth)) : mapValue(v, deps, depth),
    ]),
  );
}

/** A linked item's data, resolved from `deps` when only its PRN was sent. Stops at 4 levels deep. */
function itemData(item: CdaItem | null | undefined, deps: Dependencies, depth: number) {
  const resolved = item?.content ? item : item ? deps.get(item.prn) : undefined;
  return resolved?.content && depth <= 3 ? mapContent(resolved.content, deps, depth) : null;
}

export const mapItem = (item: CdaItem, deps: Dependencies, locale: string | null = null): Item => ({
  id: item.prn,
  type: item.contentTypeSlug,
  title: item.displayName,
  tags: mapTags(item.tags),
  locale,
  pageId: item.primaryContentExperiencePrn,
  data: itemData(item, deps, 0) ?? {},
});

/** A component tree as blocks. Plate's root container is dropped: a page has its blocks. */
export function mapBlocks(component: CdaComponent, deps: Dependencies): Block[] {
  const toBlock = (c: CdaComponent): Block => ({
    id: c.prn,
    type: c.buildingBlockSlug,
    name: c.name ?? null,
    props: mapContent(c.content, deps),
    children: (c.components ?? []).map(toBlock),
  });
  return component.buildingBlockSlug === "root"
    ? (component.components ?? []).map(toBlock)
    : [toBlock(component)];
}
