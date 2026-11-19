/**
 * After `astro build`, on the files in dist/:
 * 1. links: every internal link and image must exist. A link missing the base path is a code bug
 *    (the build fails); a link to a page that doesn't exist is reported to editors.
 * 2. search: the title and text of every page go into search-index.json.
 * 3. login: with SITE_USERNAME + SITE_PASSWORD, every page, the search index and the editor
 *    preview's data are encrypted, and the login and preview pages get the login settings. Without
 *    them (local builds) everything stays readable.
 * Plain files only, so the result can be served by any static host.
 */
import { existsSync } from "node:fs";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import type { SearchPage } from "@team-intranet/core";
import type { AstroIntegration } from "astro";
import { candidates, checkUrl, extractUrls, pageUrl } from "./links";
import {
  authConfig,
  deriveKey,
  encrypt,
  injectAuthConfig,
  shell,
  validateCredentials,
} from "./protect";
import { report, type Finding } from "./report";
import { searchEntry } from "./search-index";

/** Pages anyone may open: they hold no content (the editor preview gets its draft from the editor). */
const PUBLIC = new Set(["/login/", "/404.html", "/editor/"]);
/** Pages that get the login settings. */
const SIGN_IN = ["/login/", "/editor/"];
const NOT_SEARCHABLE = new Set([...PUBLIC, "/search/"]);

async function walk(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)])),
  );
  return nested.flat();
}

export default function intranet(): AstroIntegration {
  let base = "/";
  const env = process.env;
  const username = env.SITE_USERNAME ?? "";
  const password = env.SITE_PASSWORD ?? "";
  const hours = Number(env.SESSION_HOURS || 12);

  return {
    name: "team-intranet",
    hooks: {
      "astro:config:done": ({ config }) => {
        base = config.base.replace(/\/?$/, "/");
      },
      "astro:build:start": () => {
        const problem = validateCredentials(username, password);
        if (problem) throw new Error(problem);
        if (!(hours > 0))
          throw new Error(`SESSION_HOURS must be a positive number (got "${env.SESSION_HOURS}").`);
      },
      "astro:build:done": async ({ dir, logger }) => {
        const dist = fileURLToPath(dir);
        const pages = (await walk(dist))
          .filter((file) => file.endsWith(".html"))
          .map((file) => ({ file, url: pageUrl(relative(dist, file).split(sep).join("/")) }));
        const html = new Map(
          await Promise.all(
            pages.map(async (p) => [p.url, await readFile(p.file, "utf8")] as const),
          ),
        );

        // 1. Links.
        const exists = (path: string) =>
          candidates(path).some((file) => existsSync(join(dist, file)));
        const missingBase: string[] = [];
        const broken = new Map<string, Finding>();
        for (const { url } of pages) {
          if (url === "/404.html" || url === "/editor/") continue;
          for (const link of extractUrls(html.get(url)!)) {
            const problem = checkUrl(link, url, {
              base,
              exists: (path) => path.startsWith("/editor/") || exists(path),
            });
            if (problem?.kind === "missing-base") missingBase.push(`${url}: ${problem.target}`);
            else if (problem) {
              const page = url === "/" ? url : url.replace(/\/$/, "");
              broken.set(`${page} ${problem.target}`, {
                page,
                subject: `link to ${problem.target}`,
                message: "that page doesn't exist",
              });
            }
          }
        }
        if (missingBase.length)
          throw new Error(
            `URLs without the base path "${base}" (use withBase() from src/lib/url.ts):\n  ${missingBase.join("\n  ")}`,
          );
        report(
          "broken-links",
          {
            title: "Broken links",
            intro:
              "These pages link to pages that don't exist (moved, renamed or unpublished). Fix the link in the CMS and publish again.",
          },
          [...broken.values()].sort(
            (a, b) => a.page.localeCompare(b.page) || a.subject.localeCompare(b.subject),
          ),
        );

        // 2. Search index.
        const index: SearchPage[] = pages
          .filter(({ url }) => !NOT_SEARCHABLE.has(url))
          .flatMap(({ url }) => searchEntry(html.get(url)!, base + url.slice(1)) ?? [])
          .sort((a, b) => a.url.localeCompare(b.url));

        // 3. Login.
        const key = password ? deriveKey(username, password) : null;
        const login = pages.find((p) => p.url === "/login/");
        if (key && !login)
          throw new Error(
            "dist/login/index.html is missing: encrypted pages would have no way to sign in.",
          );
        const config = key ? authConfig({ username, key, base, hours }) : null;
        for (const page of pages.filter(({ url }) => SIGN_IN.includes(url)))
          await writeFile(page.file, injectAuthConfig(html.get(page.url)!, config));
        // The published site for the editor preview: its content is encrypted like the pages.
        const previewData = join(dist, "editor", "site.json");
        if (key && existsSync(previewData)) {
          const { content, options } = JSON.parse(await readFile(previewData, "utf8"));
          await writeFile(
            previewData,
            JSON.stringify({ options, encrypted: true, ...encrypt(JSON.stringify(content), key) }),
          );
        }
        if (key)
          await Promise.all(
            pages
              .filter(({ url }) => !PUBLIC.has(url))
              .map(({ file, url }) => writeFile(file, shell(encrypt(html.get(url)!, key), base))),
          );
        const json = JSON.stringify({ pages: index });
        await writeFile(
          join(dist, "search-index.json"),
          JSON.stringify(
            key ? { encrypted: true, ...encrypt(json, key) } : { encrypted: false, pages: index },
          ),
        );

        logger.info(
          `${pages.length} pages · ${index.length} searchable · ${broken.size} broken link(s) · ${key ? "encrypted (login required)" : "NOT protected (no SITE_PASSWORD)"}`,
        );
      },
    },
  };
}
