/**
 * Does the Plate theme cover the core contract? Every block type the site renders must exist in
 * Plate with a field for each prop, every Plate block must have a component, and the same for items.
 */
import { blockSchemas, itemSchemas } from "@team-intranet/core";
import { toCamelCase, type Field, type Theme } from "./theme";

/** Plate's container block: the site drops it (pages have their blocks). */
const CONTAINERS = new Set(["root"]);

const missingFields = (owner: string, keys: string[], fields: Field[]) => {
  const have = new Set(fields.map((f) => toCamelCase(f.slug)));
  return keys.filter((key) => !have.has(key)).map((key) => `${owner} has no field for "${key}".`);
};

export function checkContract(theme: Theme): string[] {
  const problems: string[] = [];
  const blocks = new Map(theme.blocks.map((b) => [b.slug, b]));
  const types = new Map(theme.contentTypes.map((t) => [t.slug, t]));

  for (const [type, schema] of Object.entries(blockSchemas)) {
    const block = blocks.get(type);
    if (!block)
      problems.push(`Block "${type}" is in the core contract but not in the Plate theme.`);
    else
      problems.push(
        ...missingFields(
          `Plate block "${type}"`,
          Object.keys(schema.shape),
          block.buildingBlockFields,
        ),
      );
  }
  for (const slug of blocks.keys())
    if (!CONTAINERS.has(slug) && !Object.hasOwn(blockSchemas, slug))
      problems.push(
        `Plate block "${slug}" has no schema in core (packages/core/src/schemas.ts) and no component.`,
      );

  for (const [type, schema] of Object.entries(itemSchemas)) {
    const contentType = types.get(type);
    if (!contentType)
      problems.push(`Item type "${type}" is in the core contract but not in the Plate theme.`);
    else
      problems.push(
        ...missingFields(
          `Plate content type "${type}"`,
          Object.keys(schema.shape),
          contentType.contentFields,
        ),
      );
  }
  return problems;
}
