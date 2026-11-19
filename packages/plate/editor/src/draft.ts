/**
 * Live editor drafts → core pages. Plate's editor posts the unsaved experience in its GraphQL shape;
 * delta-client converts it to the "accessible" shape the CDA uses, so plate/source maps it exactly
 * like a published page.
 */
import type { ContentExperience, ExperienceComponent } from "@platecms/delta-client/graphql";
import { parseDataFromAccessibleContentExperienceFromContentExperience as toAccessible } from "@platecms/delta-client/parsers";
import { getChildPlacements } from "@platecms/delta-client/utils";
import { normalizePath, parentPath, type Block, type Page } from "@team-intranet/core";
import type { CdaComponent } from "@team-intranet/plate-connector";
import { mapBlocks, mapTags } from "@team-intranet/plate-source";

/** Component PRN → PRN of the placement that holds it: what Plate selects on a click. */
function placements(
  component: ExperienceComponent | null | undefined,
  map = new Map<string, string>(),
) {
  if (!component) return map;
  let children: ReturnType<typeof getChildPlacements>;
  try {
    children = getChildPlacements(component);
  } catch {
    children = component.childPlacements ?? [];
  }
  for (const placement of children) {
    if (!placement?.experienceComponent) continue;
    map.set(placement.experienceComponent.prn, placement.prn);
    placements(placement.experienceComponent, map);
  }
  return map;
}

const NO_DEPENDENCIES = new Map();

/** The blocks of a root component sent on its own (ROOT_EXPERIENCE_COMPONENT_SEND). */
export function blocksFromDraft(component: ExperienceComponent): Block[] {
  const accessible = toAccessible({
    experienceComponent: component,
  } as ContentExperience).experienceComponent;
  return mapBlocks(accessible as unknown as CdaComponent, NO_DEPENDENCIES, placements(component));
}

/** A whole draft (CONTENT_EXPERIENCE_SEND). Its primary item is filled in from the published site. */
export function pageFromDraft(draft: ContentExperience): Page {
  const accessible = toAccessible(draft);
  const path = normalizePath(accessible.path);
  return {
    id: accessible.prn,
    path,
    treeId: path,
    parentTreeId: parentPath(path),
    title: accessible.title ?? "",
    seoTitle: accessible.seoTitle ?? null,
    description: accessible.seoDescription ?? null,
    tags: mapTags(accessible.tags),
    updatedAt: (accessible.updatedAt as string | undefined) ?? null,
    publishedAt: (draft.lastPublished as string | null | undefined) ?? null,
    primaryItem: null,
    blocks: mapBlocks(
      accessible.experienceComponent as unknown as CdaComponent,
      NO_DEPENDENCIES,
      placements(draft.experienceComponent),
    ),
  };
}
