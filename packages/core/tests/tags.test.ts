import { describe, expect, it } from "vitest";
import { hasTag, tagMatches, type Tag } from "../src";

const tag = (id: string, path: string | null, ancestorIds?: string[]): Tag => ({
  id,
  name: path?.split("/").pop() ?? null,
  path,
  color: null,
  ancestorIds,
});
const newHires = tag("nh", "P&O/New hires", ["po"]);

describe("tagMatches", () => {
  it("matches the tag itself and its parents by id", () => {
    expect(tagMatches(newHires, { id: "nh" })).toBe(true);
    expect(tagMatches(newHires, { id: "po" })).toBe(true);
  });
  it("matches a parent by path when no ids are known", () => {
    expect(tagMatches(tag("x", "P&O/New hires"), { path: "P&O" })).toBe(true);
  });
  it("does not match a sibling or a name prefix", () => {
    expect(tagMatches(newHires, { id: "policies", path: "P&O/Policies" })).toBe(false);
    expect(tagMatches(tag("x", "P&O Extra"), { path: "P&O" })).toBe(false);
  });
  it("matches nothing without a filter", () => {
    expect(tagMatches(newHires, {})).toBe(false);
  });
  it("hasTag is true when any tag matches", () => {
    expect(hasTag([tag("m", "Migrated"), newHires], { id: "po" })).toBe(true);
    expect(hasTag([tag("m", "Migrated")], { id: "po" })).toBe(false);
  });
});
