/**
 * The site's content: one load per build, from the source named by CONTENT_SOURCE. The site only
 * sees the core model, so adding a CMS means adding a source here, nothing else.
 */
import { createSite, findInvalidContent, type ContentSource, type Site } from "@team-intranet/core";
import { createPlateSource, plateConfigFromEnv } from "@team-intranet/plate-source";
import { report } from "../integrations/report";
import { demoSource } from "./demo";
import { siteOptions } from "./options";

// Vite's env has apps/site/.env; process.env has what the shell or CI sets, and wins.
const env = { ...import.meta.env, ...process.env } as Record<string, string | undefined>;

export const options = siteOptions(env);
export const { languages } = options;

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
        reportOnce(
          findInvalidContent(content).map((p) => ({
            page: p.page,
            subject: `${p.subject}${p.field ? ` · field "${p.field}"` : ""}`,
            message: `${p.message} (${p.id})`,
          })),
        );
        return createSite(content, options);
      });
    // Never keep a failed load: the next page load retries.
    loading.catch(() => (loading = undefined));
  }
  return loading;
}

/** Content left out of the site, reported once per distinct list (Astro may load this module twice). */
const REPORTED = Symbol.for("team-intranet.content-report");
function reportOnce(findings: Parameters<typeof report>[2]) {
  const state = globalThis as { [REPORTED]?: string };
  const fingerprint = JSON.stringify(findings);
  if (state[REPORTED] === fingerprint) return;
  state[REPORTED] = fingerprint;
  report(
    "content-problems",
    {
      title: "Content left out",
      intro:
        "The site was published without these blocks and items. Fix them in the CMS and publish again; in development they show the problem in place.",
    },
    findings,
  );
}
