import { itemSchemas } from "@team-intranet/core";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { checkContract, diffTheme, ITEM_TYPES, prepareTheme, readTheme } from "../src";

const snapshot = readTheme(fileURLToPath(new URL("../delta", import.meta.url)));

describe("the Plate theme snapshot", () => {
  it("covers the core contract: every block and item type, with a field for each prop", () => {
    expect(checkContract(snapshot)).toEqual([]);
  });

  it("lists the same item types as core", () => {
    expect([...ITEM_TYPES].sort()).toEqual(Object.keys(itemSchemas).sort());
  });
});

describe("checkContract", () => {
  it("names missing blocks, missing fields and blocks without a component", () => {
    const theme = {
      ...snapshot,
      blocks: [
        ...snapshot.blocks.filter((b) => b.slug !== "gallery"),
        { slug: "banner", title: "Banner", buildingBlockFields: [] },
      ].map((b) =>
        b.slug === "hero"
          ? {
              ...b,
              buildingBlockFields: b.buildingBlockFields.filter((f) => f.slug !== "cta-link"),
            }
          : b,
      ),
    };
    expect(checkContract(theme)).toEqual([
      'Block "gallery" is in the core contract but not in the Plate theme.',
      'Plate block "hero" has no field for "ctaLink".',
      'Plate block "banner" has no schema in core (packages/core/src/schemas.ts) and no component.',
    ]);
  });
});

describe("prepareTheme", () => {
  const rule = (types: string[]) => ({
    ruleType: "RELATABLE_CONTENT_TYPES",
    settings: { allowedContentTypes: types },
  });
  const type = (slug: string, links: string[] = []) => ({
    prn: `prn:type:${slug}`,
    slug,
    name: slug,
    updatedAt: "now",
    contentFields: links.length ? [{ slug: "items", contentValidationRules: [rule(links)] }] : [],
  });
  const allTypes = ITEM_TYPES.map((slug) => type(slug));

  it("turns linked PRNs into slugs, keeps only the site's types and drops noise", () => {
    const theme = prepareTheme({
      blocks: [
        {
          slug: "cards",
          buildingBlockFields: [
            { slug: "cards", prn: "x", contentValidationRules: [rule(["prn:type:card"])] },
          ],
        },
      ],
      contentTypes: [...allTypes, type("unrelated")],
    });
    expect("errors" in theme).toBe(false);
    if ("errors" in theme) return;
    expect(theme.blocks[0]!.buildingBlockFields[0]).toEqual({
      slug: "cards",
      title: "cards",
      contentValidationRules: [rule(["card"])],
    });
    expect(theme.contentTypes.map((t) => t.slug)).toEqual([...ITEM_TYPES].sort());
  });

  it("refuses an incomplete theme", () => {
    const result = prepareTheme({ blocks: [], contentTypes: allTypes.slice(1) });
    expect("errors" in result && result.errors.join(" ")).toMatch(
      /no building blocks.*missing.*card/,
    );
  });

  it("diffs two snapshots", () => {
    const after = { ...snapshot, blocks: snapshot.blocks.slice(1) };
    expect(diffTheme(snapshot, after).blocks).toEqual({
      added: [],
      removed: [snapshot.blocks[0]!.slug],
      changed: [],
    });
  });
});
