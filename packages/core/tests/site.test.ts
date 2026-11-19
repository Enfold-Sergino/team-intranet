import { describe, expect, it } from "vitest";
import { createSite, languageOf, parseLanguages, translatePath } from "../src";
import { block, content, en, item, languages, nl, page } from "./fixtures";

describe("page tree", () => {
  const site = createSite(
    content([
      page("/"),
      page("/projects"),
      page("/projects/beta"),
      page("/projects/alpha"),
      page("/projects/gamma", { parentTreeId: null }), // found through its parent path
      page("/people"),
    ]),
    { languages },
  );

  it("finds pages by path", () => {
    expect(site.page("/projects/alpha")?.title).toBe("alpha");
    expect(site.page("/nope")).toBeUndefined();
    expect(site.page(null)).toBeUndefined();
  });

  it("lists children by treeId and by parent path, in title order", () => {
    expect(site.children(site.page("/projects")!).map((p) => p.title)).toEqual([
      "alpha",
      "beta",
      "gamma",
    ]);
    expect(site.children(site.page("/people")!)).toEqual([]);
  });

  it("builds breadcrumbs from the root", () => {
    expect(site.breadcrumbs(site.page("/projects/alpha")!).map((p) => p.path)).toEqual([
      "/",
      "/projects",
      "/projects/alpha",
    ]);
  });

  it("builds the navigation once", () => {
    expect(site.navigation()).toBe(site.navigation());
  });

  it("titles a page after its primary item", () => {
    const p = page("/x", { primaryItem: item("project", { title: "Apollo" }) });
    expect(site.title(p)).toBe("Apollo");
  });
});

describe("languages", () => {
  const pages = () => [
    page("/"),
    page("/team"),
    page("/team/office"),
    page("/projects"),
    page("/nl", { parentTreeId: "/" }),
    page("/nl/team"),
    page("/nl/team/office"),
  ];

  it("parses languages and matches the longest root", () => {
    const parsed = parseLanguages("en-GB:EN:English:/, nl-NL:NL:Nederlands:nl/");
    expect(parsed.map((l) => l.root)).toEqual(["/nl", "/"]);
    expect(languageOf("/nl/team", parsed).code).toBe("nl-NL");
    expect(languageOf("/nl", parsed).code).toBe("nl-NL");
    expect(languageOf("/nlx", parsed).code).toBe("en-GB");
    expect(languageOf("/", parsed).code).toBe("en-GB");
  });

  it("maps a path to the other language", () => {
    expect(translatePath("/team/office", nl, languages)).toBe("/nl/team/office");
    expect(translatePath("/nl/team/office", en, languages)).toBe("/team/office");
    expect(translatePath("/", nl, languages)).toBe("/nl");
    expect(translatePath("/nl", en, languages)).toBe("/");
  });

  it("scopes navigation to a language", () => {
    const site = createSite(content(pages()), { languages });
    const english = site.forLanguage(en);
    const dutch = site.forLanguage(nl);
    expect(english.navigation().map((n) => n.path)).toEqual(["/", "/projects", "/team"]);
    expect(dutch.navigation().map((n) => n.path)).toEqual(["/nl", "/nl/team"]);
    expect(dutch.navigation()[1]!.children.map((n) => n.path)).toEqual(["/nl/team/office"]);
    expect(dutch.isActive(dutch.navigation()[0]!, "/nl")).toBe(true);
    expect(dutch.isActive(dutch.navigation()[0]!, "/nl/team")).toBe(false);
    expect(site.forLanguage(nl)).toBe(dutch);
  });

  it("puts a page whose parent isn't translated under its nearest translated ancestor", () => {
    const site = createSite(
      content([...pages(), page("/nl/projects"), page("/nl/projects/research/report")]),
      { languages },
    );
    const dutch = site.forLanguage(nl).navigation();
    expect(dutch.map((n) => n.path)).toEqual(["/nl", "/nl/projects", "/nl/team"]);
    expect(dutch[1]!.children.map((n) => n.path)).toEqual(["/nl/projects/research/report"]);
  });

  it("gives each language its own items, borrowing a type it has none of", () => {
    const at = (id: string, type: string, locale: string | null) => item(type, {}, { id, locale });
    const site = createSite(
      content(pages(), [
        at("link-en", "link", "en-GB"),
        at("link-nl", "link", "nl-NL"),
        at("settings-en", "site-settings", "en-GB"),
        at("shared", "person", null),
      ]),
      { languages },
    );
    expect(site.forLanguage(en).items.map((i) => i.id)).toEqual([
      "link-en",
      "settings-en",
      "shared",
    ]);
    expect(site.forLanguage(nl).items.map((i) => i.id)).toEqual([
      "link-nl",
      "shared",
      "settings-en",
    ]);
  });

  it("links to the same page in the other language, or to its home", () => {
    const site = createSite(content(pages()), { languages });
    expect(site.languageLinks("/team/office")).toEqual([
      { language: en, href: "/team/office", current: true, exists: true },
      { language: nl, href: "/nl/team/office", current: false, exists: true },
    ]);
    expect(site.languageLinks("/projects")[1]).toMatchObject({ href: "/nl", exists: false });
    // A language-scoped site still finds the other language's pages.
    expect(site.forLanguage(nl).languageLinks("/nl/team")[0]).toMatchObject({
      href: "/team",
      exists: true,
    });
  });
});

describe("reading order", () => {
  const C = "/procedure-overview/course";
  const steps = [block("procedure-steps")];
  const titled = (path: string, title: string, blocks = [] as typeof steps) =>
    page(path, { title, blocks });
  const site = createSite(
    content([
      titled("/", "Home"),
      titled("/procedure-overview", "Procedure overview"),
      titled(C, "Employee introduction course"),
      titled(`${C}/l10`, "Lesson 10 - Wrap-up"),
      titled(`${C}/l2`, "Lesson 2 - Structure"),
      titled(`${C}/l1`, "Lesson 1 - Parents"),
      titled(`${C}/l1/article`, "Article about the parents"),
      titled("/procedure-overview/expenses", "Expenses"),
      // Outside the sequence sections only procedure pages are linked, with their siblings.
      titled("/p-o/onboarding", "Onboarding"),
      titled("/p-o/onboarding/a", "1. Accounts", steps),
      titled("/p-o/onboarding/links", "Useful links"),
      titled("/p-o/onboarding/b", "2. Laptop", steps),
      titled("/about", "About"),
    ]),
    { languages, sequenceSections: ["/procedure-overview"] },
  );
  const around = (path: string) => {
    const { previous, next } = site.neighbours(site.page(path)!);
    return [previous?.title ?? null, next?.title ?? null];
  };

  it("walks a section depth-first, numbers in numeric order", () => {
    expect(site.readingOrder(site.page("/procedure-overview")!).map((p) => p.title)).toEqual([
      "Employee introduction course",
      "Lesson 1 - Parents",
      "Article about the parents",
      "Lesson 2 - Structure",
      "Lesson 10 - Wrap-up",
      "Expenses",
    ]);
  });

  it("links pages in a sequence section like a book", () => {
    expect(around(C)).toEqual([null, "Lesson 1 - Parents"]);
    expect(around(`${C}/l1`)).toEqual([
      "Employee introduction course",
      "Article about the parents",
    ]);
    expect(around(`${C}/l1/article`)).toEqual(["Lesson 1 - Parents", "Lesson 2 - Structure"]);
    expect(around(`${C}/l10`)).toEqual(["Lesson 2 - Structure", "Expenses"]);
    expect(around("/procedure-overview/expenses")).toEqual(["Lesson 10 - Wrap-up", null]);
    expect(around("/procedure-overview")).toEqual([null, null]);
  });

  it("links procedure pages to their sibling procedures elsewhere", () => {
    expect(around("/p-o/onboarding/a")).toEqual([null, "2. Laptop"]);
    expect(around("/p-o/onboarding/b")).toEqual(["1. Accounts", null]);
    expect(around("/p-o/onboarding/links")).toEqual([null, null]);
    expect(around("/about")).toEqual([null, null]);
  });
});
