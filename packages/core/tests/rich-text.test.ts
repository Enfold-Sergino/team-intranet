import { describe, expect, it } from "vitest";
import { excerpt, hasElement, isEmpty, toText, type RichText } from "../src";

const el = (tagName: string, ...children: object[]) => ({
  type: "element",
  tagName,
  properties: {},
  children,
});
const text = (value: string) => ({ type: "text", value });
const tree = (...children: object[]) => ({ type: "root", children }) as RichText;

const doc = tree(
  el("h2", text("Intro")),
  el("p", text("Who we are, "), el("strong", text("our offices")), text(" and the team.")),
);

describe("rich text", () => {
  it("joins text without markup", () => {
    expect(toText(doc)).toBe("Intro Who we are, our offices and the team.");
  });

  it("cuts long text at a word boundary", () => {
    expect(excerpt(doc, 20)).toBe("Intro Who we are…");
    expect(excerpt(tree(el("p", text("  "))))).toBeNull();
  });

  it("finds elements and treats an image as content", () => {
    expect(hasElement(doc, "strong")).toBe(true);
    expect(hasElement(doc, "h1")).toBe(false);
    expect(isEmpty(tree(el("p", text(" "))))).toBe(true);
    expect(isEmpty(tree(el("img")))).toBe(false);
    expect(isEmpty(null)).toBe(true);
  });
});
