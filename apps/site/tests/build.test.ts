import { describe, expect, it } from "vitest";
import { candidates, checkUrl, extractUrls, pageUrl } from "../src/integrations/links";
import {
  annotation,
  report,
  summaryMarkdown,
  type Finding,
  type ReportTarget,
} from "../src/integrations/report";
import { searchEntry } from "../src/integrations/search-index";
import { safeReturnTo } from "../src/lib/return-to";

describe("links", () => {
  it("finds href, src, srcset and meta refresh targets", () => {
    const html =
      '<a href="/a?x=1&amp;y=2">a</a><img src="/b.png" srcset="/c.png 1x, /d.png 2x"><meta http-equiv="refresh" content="0; url=/e">';
    expect(extractUrls(html)).toEqual(["/a?x=1&y=2", "/b.png", "/c.png", "/d.png", "/e"]);
  });

  it("maps files to paths and back", () => {
    expect(pageUrl("index.html")).toBe("/");
    expect(pageUrl("projects/x/index.html")).toBe("/projects/x/");
    expect(candidates("/projects/")).toEqual(["projects/index.html"]);
    expect(candidates("/projects")).toEqual(["projects", "projects/index.html", "projects.html"]);
  });

  const files = new Set(["/", "/projects", "/assets/logo.svg"]);
  const exists = (path: string) => files.has(path.replace(/\/$/, "") || "/");
  const opts = { base: "/intranet/", exists };

  it("accepts links to existing paths, also relative ones", () => {
    expect(checkUrl("/intranet/projects/", "/", opts)).toBeNull();
    expect(checkUrl("/intranet/assets/logo.svg#x", "/", opts)).toBeNull();
    expect(checkUrl("../projects", "/people/", { base: "/", exists })).toBeNull();
  });

  it("flags links without the base path and links to missing pages", () => {
    expect(checkUrl("/projects", "/", opts)).toEqual({ kind: "missing-base", target: "/projects" });
    expect(checkUrl("/intranet/gone", "/", opts)).toEqual({
      kind: "broken",
      target: "/intranet/gone",
    });
  });

  it("skips external, hash and mail links", () => {
    for (const url of ["https://x.test/", "//cdn.test/a", "#top", "mailto:a@b.test"])
      expect(checkUrl(url, "/", opts)).toBeNull();
  });
});

describe("searchEntry", () => {
  it("takes the h1 and the main text, without scripts, navigation and markup", () => {
    const html =
      '<title>T</title><header>Menu</header><main><nav aria-label="Breadcrumb"><a>Home</a></nav><h1>Onboarding &amp; IT</h1>' +
      '<div class="[&_li>p]:my-0"><p>Request a <strong>laptop</strong>.</p></div><script>var x = 1;</script></main>';
    expect(searchEntry(html, "/onboarding/")).toEqual({
      url: "/onboarding/",
      title: "Onboarding & IT",
      text: "Onboarding & IT Request a laptop .",
    });
  });

  it("skips redirects and pages without <main>, and caps long text", () => {
    expect(
      searchEntry('<meta http-equiv="refresh" content="0; url=/"><main>x</main>', "/a/"),
    ).toBeNull();
    expect(searchEntry("<body>x</body>", "/b/")).toBeNull();
    expect(
      searchEntry(`<title>Docs</title><main>${"word ".repeat(2000)}</main>`, "/d/")!.text,
    ).toHaveLength(4000);
  });
});

describe("report", () => {
  const finding: Finding = {
    page: "/a,b",
    subject: 'block "cards"',
    message: "50% done\nnext | line",
  };
  const target = (env: Record<string, string>) => {
    const out = {
      log: [] as string[],
      warn: [] as string[],
      summary: [] as string[],
      saved: [] as string[],
    };
    const t: ReportTarget = {
      env,
      log: (l) => out.log.push(l),
      warn: (l) => out.warn.push(l),
      appendSummary: (_, md) => out.summary.push(md),
      save: (name) => out.saved.push(name),
    };
    return { out, t };
  };
  const meta = { title: "Content left out", intro: "Fix it." };

  it("escapes GitHub workflow commands and Markdown cells", () => {
    expect(annotation("Broken links", finding)).toBe(
      '::warning title=Broken links%3A /a%2Cb::/a,b · block "cards": 50%25 done%0Anext | line',
    );
    expect(summaryMarkdown("Broken links", "x", [finding])).toContain(
      '| /a,b | block "cards" | 50% done next \\| line |',
    );
  });

  it("annotates in GitHub Actions, lists elsewhere, and always saves", () => {
    const gh = target({ GITHUB_ACTIONS: "true", GITHUB_STEP_SUMMARY: "/tmp/s" });
    report("content-problems", meta, [finding], gh.t);
    expect(gh.out.log).toHaveLength(1);
    expect(gh.out.summary).toHaveLength(1);
    const local = target({});
    report("content-problems", meta, [finding], local.t);
    expect(local.out.warn[0]).toContain("Content left out (1)");
    const none = target({ GITHUB_ACTIONS: "true" });
    report("content-problems", meta, [], none.t);
    expect(none.out).toEqual({ log: [], warn: [], summary: [], saved: ["content-problems"] });
  });
});

describe("safeReturnTo", () => {
  const origin = "https://intranet.example";
  it.each([
    ["/intranet/", "/intranet/projects/alpha", "/intranet/projects/alpha"],
    ["/intranet/", "/intranet/a?b=1#c", "/intranet/a?b=1#c"],
    ["/", "/projects", "/projects"],
  ])("base %s keeps %s", (base, value, expected) =>
    expect(safeReturnTo(value, base, origin)).toBe(expected),
  );

  it.each([
    null,
    "",
    "https://evil.example/intranet/",
    "//evil.example/intranet/",
    "/\\evil.example/intranet/",
    "/other/page",
    "/intranet/login/",
    "javascript:alert(1)",
  ])("sends %s to the homepage", (value) =>
    expect(safeReturnTo(value, "/intranet/", origin)).toBe("/intranet/"),
  );
});
