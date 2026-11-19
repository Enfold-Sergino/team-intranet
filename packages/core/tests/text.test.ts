import { describe, expect, it } from "vitest";
import { asString, asUrl, normalizePath, parentPath } from "../src";

describe("asString", () => {
  it("trims, and turns empty or non-string values into null", () => {
    expect(asString("  a ")).toBe("a");
    expect(asString("   ")).toBeNull();
    expect(asString(3)).toBeNull();
  });
});

describe("asUrl", () => {
  it.each([
    "https://example.com/a?b=1",
    "http://example.com",
    "mailto:team@example.com",
    "tel:+31201234567",
    "/projects/alpha",
    "#top",
    " /trimmed ",
  ])("keeps %s", (url) => expect(asUrl(url)).toBe(url.trim()));

  it.each([
    "javascript:alert(1)",
    " JaVaScRiPt:alert(1)",
    "data:text/html,x",
    "vbscript:x",
    "//evil.example",
    "/\\evil.example",
    "\\\\evil.example",
    "www.example.com",
    "",
    null,
    7,
  ])("drops %s", (url) => expect(asUrl(url)).toBeNull());
});

describe("paths", () => {
  it("normalises and walks up", () => {
    expect(normalizePath(" a//b/ ")).toBe("/a/b");
    expect(normalizePath("")).toBe("/");
    expect(parentPath("/a/b")).toBe("/a");
    expect(parentPath("/a")).toBe("/");
    expect(parentPath("/")).toBeNull();
  });
});
