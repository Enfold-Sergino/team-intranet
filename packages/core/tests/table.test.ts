import { describe, expect, it } from "vitest";
import { cellParts, splitRow } from "../src";

describe("table", () => {
  it("splits on | first, else on tabs or ;", () => {
    expect(splitRow("a | b|c")).toEqual(["a", "b", "c"]);
    expect(splitRow("a;b\tc")).toEqual(["a", "b", "c"]);
    expect(splitRow("a; b | c")).toEqual(["a; b", "c"]);
  });

  it("turns Markdown links into parts and keeps unsafe ones as text", () => {
    expect(cellParts("See [policy](/p) or [x](javascript:1) and [docs](https://x.io)")).toEqual([
      { text: "See " },
      { text: "policy", href: "/p", external: false },
      { text: " or " },
      { text: "[x](javascript:1)" },
      { text: " and " },
      { text: "docs", href: "https://x.io", external: true },
    ]);
  });
});
