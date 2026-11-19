import { blockSchemas } from "@team-intranet/core";
import { describe, expect, it } from "vitest";
import { blocksFromDraft, pageFromDraft } from "../src";

// A minimal GraphQL ContentExperience as Plate's live editor posts it. All data is invented.
const field = (prn: string, slug: string) => ({ prn, slug, contentValidationRules: [] });
const value = (fieldPrn: string, contentValue: Record<string, unknown>) => ({
  buildingBlockField: { prn: fieldPrn },
  contentValue,
});
const component = (
  prn: string,
  slug: string,
  fields: unknown[],
  values: unknown[],
  children: { prn: string }[] = [],
) => ({
  prn,
  isDraft: true,
  isGlobal: false,
  name: null,
  buildingBlock: { slug, buildingBlockFields: fields },
  buildingBlockFieldFulfillments: values,
  childPlacements: children.map((child, i) => ({
    prn: `placement-${child.prn}`,
    position: `a${i}`,
    experienceComponent: child,
  })),
});

const root = component(
  "root",
  "root",
  [],
  [],
  [
    component(
      "second",
      "callout",
      [field("f-title", "title")],
      [value("f-title", { valueTypeName: "STRING", primitiveValue: "Second" })],
    ),
    component(
      "first",
      "hero",
      [field("f-title", "title"), field("f-intro", "intro"), field("f-link", "cta-link")],
      [
        value("f-title", { valueTypeName: "STRING", primitiveValue: "Draft <title>" }),
        value("f-intro", {
          valueTypeName: "SMART_TEXT",
          interpolatedSmartText: {
            type: "root",
            children: [{ type: "paragraph", children: [{ type: "text", value: "Body" }] }],
          },
        }),
        value("f-link", {
          valueTypeName: "PATH_PART",
          linkedPathPart: { prn: "pp", path: "/team/" },
        }),
      ],
    ),
  ],
);
// Placements are ordered by position, not by array order.
root.childPlacements.reverse();
const draft = {
  prn: "exp",
  title: "Projects",
  slug: "projects",
  tags: [{ prn: "t1", name: "Delivery" }],
  pathPart: { path: "/projects/", channel: { prn: "c" } },
  experienceComponent: root,
};

describe("live editor drafts", () => {
  it("become core pages with blocks the editor can select", () => {
    const page = pageFromDraft(draft as never);
    expect(page).toMatchObject({
      id: "exp",
      path: "/projects",
      parentTreeId: "/",
      title: "Projects",
    });
    expect(page.tags.map((t) => t.name)).toEqual(["Delivery"]);
    expect(page.blocks.map((b) => [b.type, b.editorId, b.props.title])).toEqual([
      ["callout", "placement-second", "Second"],
      ["hero", "placement-first", "Draft <title>"],
    ]);
  });

  it("map values exactly like published pages, so they pass the core contract", () => {
    const hero = blocksFromDraft(root as never)[1]!;
    expect(hero.props.ctaLink).toEqual({ id: "pp", path: "/team" });
    expect(hero.props.intro).toMatchObject({ type: "root", children: [{ tagName: "p" }] });
    expect(blockSchemas.hero.safeParse(hero.props).success).toBe(true);
  });
});
