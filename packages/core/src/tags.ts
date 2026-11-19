import type { Tag } from "./model";

export interface TagFilter {
  id?: string | null;
  path?: string | null;
}

/**
 * Does `tag` match the filter, including tags nested under it? Pages carry only their deepest tag
 * ("P&O/New hires"), so filtering on "P&O" must find its descendants: by ancestor ids when the CMS
 * provides them, otherwise by name path.
 */
export function tagMatches(tag: Tag, filter: TagFilter): boolean {
  if (filter.id && (tag.id === filter.id || tag.ancestorIds?.includes(filter.id))) return true;
  return Boolean(
    filter.path && tag.path && (tag.path === filter.path || tag.path.startsWith(`${filter.path}/`)),
  );
}

export const hasTag = (tags: Tag[], filter: TagFilter) => tags.some((t) => tagMatches(t, filter));
