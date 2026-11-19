/** How the site reads its content: shared by the build and the live editor preview. */
import { parseLanguages, type SiteOptions } from "@team-intranet/core";

export const siteOptions = (env: Record<string, string | undefined>): SiteOptions => ({
  languages: parseLanguages(env.SITE_LANGUAGES || "en-GB:EN:English:/,nl-NL:NL:Nederlands:/nl"),
  /** Sections read like a book: every page below them gets previous/next links. */
  sequenceSections: ["/procedure-overview"],
  siteName: "Team intranet",
});
