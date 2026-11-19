import { describe, expect, it } from "vitest";
import { fold, search, snippet, terms } from "../src";

const pages = [
  { url: "/a/", title: "Laptop policy", text: "Who gets which laptop and how to order one." },
  { url: "/b/", title: "Onboarding", text: "Day one: collect your laptop at the office." },
  { url: "/c/", title: "Café rules", text: "Coffee is free." },
];

describe("search", () => {
  it("folds case and accents", () => {
    expect(fold("Café ÉCLAIR")).toBe("cafe eclair");
    expect(terms("  Laptop laptop  order ")).toEqual(["laptop", "order"]);
  });

  it("requires every term and ranks title matches first", () => {
    expect(search(pages, "laptop").map((r) => r.url)).toEqual(["/a/", "/b/"]);
    expect(search(pages, "laptop office").map((r) => r.url)).toEqual(["/b/"]);
    expect(search(pages, "cafe").map((r) => r.url)).toEqual(["/c/"]);
    expect(search(pages, "   ")).toEqual([]);
  });

  it("makes a snippet around the first match", () => {
    const text = `${"intro ".repeat(50)}the laptop is here ${"outro ".repeat(50)}`;
    const result = snippet(text, ["laptop"], 60);
    expect(result).toContain("laptop");
    expect(result.startsWith("…")).toBe(true);
    expect(result.endsWith("…")).toBe(true);
  });
});
