/**
 * The site's content: one load per build, from the source named by CONTENT_SOURCE. The site only
 * sees the core model, so adding a CMS means adding a source here, nothing else.
 */
import {
  createSite,
  findInvalidContent,
  parseLanguages,
  type ContentSource,
  type Site,
} from "@team-intranet/core";
import { createPlateSource, plateConfigFromEnv } from "@team-intranet/plate-source";
import { demoSource } from "./demo";

// Vite's env has .env values; process.env has what the shell or CI sets.
const env = { ...process.env, ...import.meta.env } as Record<string, string | undefined>;

export const languages = parseLanguages(
  env.SITE_LANGUAGES || "en-GB:EN:English:/,nl-NL:NL:Nederlands:/nl",
);

/** Sections read like a book: every page below them gets previous/next links. */
const sequenceSections = ["/procedure-overview"];

function source(): ContentSource {
  switch (env.CONTENT_SOURCE || "plate") {
    case "plate":
      return createPlateSource(plateConfigFromEnv(env, languages));
    case "demo":
      return demoSource;
    default:
      throw new Error(`Unknown CONTENT_SOURCE "${env.CONTENT_SOURCE}": use plate or demo`);
  }
}

let loading: Promise<Site> | undefined;
let loadedAt = 0;
/** In `astro dev`, reload at most every few seconds so published edits show on refresh. */
const DEV_TTL_MS = 5_000;

export function getSite(): Promise<Site> {
  if (!loading || (import.meta.env.DEV && Date.now() - loadedAt > DEV_TTL_MS)) {
    loadedAt = Date.now();
    loading = source()
      .load()
      .then((content) => {
        report(
          findInvalidContent(content).map(
            (p) => `${p.page} · ${p.subject}${p.field ? ` · ${p.field}` : ""}: ${p.message}`,
          ),
        );
        return createSite(content, { languages, sequenceSections, siteName: "Team intranet" });
      });
    // Never keep a failed load: the next page load retries.
    loading.catch(() => (loading = undefined));
  }
  return loading;
}

/** Content left out of the site, reported once per distinct list (Astro may load this module twice). */
const REPORTED = Symbol.for("team-intranet.content-report");
function report(lines: string[]) {
  const state = globalThis as { [REPORTED]?: string };
  const fingerprint = lines.join("\n");
  if (!lines.length || state[REPORTED] === fingerprint) return;
  state[REPORTED] = fingerprint;
  console.warn(
    `[content] ${lines.length} problem(s), left out of the site:\n  ${lines.join("\n  ")}`,
  );
}
