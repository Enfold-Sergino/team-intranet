/**
 * Plate Content Delivery API client for builds: every request times out, network errors, 429 and
 * 5xx are retried, and every response is checked before it is used. Delta-client's fetch helpers
 * have none of that (see docs/PLAN.md), so this is the one piece of transport we keep ourselves.
 */
import { describeIssues, normalizePath } from "@team-intranet/core";
import type { z } from "zod";
import {
  cdaExperience,
  cdaExperienceList,
  cdaItemPage,
  type CdaExperience,
  type CdaItem,
} from "./schemas";

export interface CdaConfig {
  /** Channel-scoped API token (Plate → API tokens). */
  token: string;
  /** Default https://cda.platecms.app */
  baseUrl?: string;
  fetch?: typeof globalThis.fetch;
  /** Per request, default 30 s: a hanging CDA must not stall the build. */
  timeoutMs?: number;
  /** Wait between retries; replaceable in tests. */
  sleep?: (ms: number) => Promise<void>;
}

export class CdaRequestError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "CdaRequestError";
  }
}

const ATTEMPTS = 3;
/** Upper bound for pagination loops: reaching it means something is wrong, not a big site. */
const MAX_PAGES = 1000;
const XML_ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&apos;": "'",
};

const retryAfterMs = (response: Response): number | null => {
  const header = response.headers.get("retry-after");
  const seconds = header === null ? NaN : Number(header);
  return Number.isFinite(seconds) && seconds >= 0 ? Math.min(seconds, 30) * 1000 : null;
};

export type CdaClient = ReturnType<typeof createCdaClient>;

export function createCdaClient(config: CdaConfig) {
  const token = config.token?.trim();
  if (!token)
    throw new CdaRequestError("Set PLATE_DELIVERY_TOKEN (a channel-scoped Plate API token)");
  const base = (config.baseUrl || "https://cda.platecms.app").replace(/\/$/, "");
  const fetcher = config.fetch ?? globalThis.fetch;
  const timeoutMs = config.timeoutMs ?? 30_000;
  const sleep = config.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));

  async function get(path: string, accept = "application/json"): Promise<Response> {
    for (let attempt = 1; ; attempt++) {
      const last = attempt === ATTEMPTS;
      const backoff = 500 * 2 ** (attempt - 1);
      let response: Response;
      try {
        response = await fetcher(`${base}${path}`, {
          headers: { authorization: `Bearer ${token}`, accept },
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch (error) {
        if (last)
          throw new CdaRequestError(
            `Could not reach ${base}${path} after ${ATTEMPTS} attempts (${error instanceof Error ? error.message : error})`,
          );
        await sleep(backoff);
        continue;
      }
      if ((response.status !== 429 && response.status < 500) || last) return response;
      await sleep(retryAfterMs(response) ?? backoff);
    }
  }

  async function read<T extends z.ZodType>(
    response: Response,
    what: string,
    schema: T,
  ): Promise<z.output<T>> {
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new CdaRequestError(
        `CDA ${what} returned HTTP ${response.status}${body ? `: ${body.slice(0, 300)}` : ""}`,
        response.status,
      );
    }
    const result = schema.safeParse(await response.json());
    if (!result.success)
      throw new CdaRequestError(
        `CDA ${what} returned an unexpected shape: ${describeIssues(result.error)}`,
      );
    return result.data;
  }

  const json = async <T extends z.ZodType>(path: string, what: string, schema: T) =>
    read(await get(path), what, schema);

  return {
    /**
     * Published page paths: the sitemap plus the v0 list (which also has pages left out of the
     * sitemap). The v0 list must load completely, or a site with missing pages would deploy; the
     * sitemap only adds paths, so when it fails the build goes on with a warning.
     */
    async paths(): Promise<string[]> {
      const paths = new Set<string>();
      const sitemap = await get("/v1/sitemap.xml", "application/xml");
      if (sitemap.ok) {
        for (const [, loc] of (await sitemap.text()).matchAll(/<loc>([^<]+)<\/loc>/g)) {
          try {
            const url = loc!.trim().replace(/&(?:amp|lt|gt|quot|apos);/g, (e) => XML_ENTITIES[e]!);
            paths.add(normalizePath(new URL(url).pathname));
          } catch {
            console.warn(`[plate] Ignoring malformed sitemap <loc>: ${loc}`);
          }
        }
      } else
        console.warn(`[plate] Sitemap returned HTTP ${sitemap.status}; using the v0 list only.`);

      let after: string | null = null;
      for (let page = 1; page <= MAX_PAGES; page++) {
        const query: string = `first=100${after ? `&after=${encodeURIComponent(after)}` : ""}`;
        const body = await json(
          `/v0/content-experiences?${query}`,
          `v0 content-experiences (page ${page})`,
          cdaExperienceList,
        );
        for (const { node } of body.data)
          if (node.isPublished !== false && node.pathPart?.path)
            paths.add(normalizePath(node.pathPart.path));
        if (body.data.length < 100) return [...paths];
        after = body.data.at(-1)!.cursor;
      }
      throw new CdaRequestError(`The v0 page list has more than ${MAX_PAGES} pages of results`);
    },

    /** The published page at `path`, or null when it is gone (unpublished since it was listed). */
    async experience(path: string): Promise<CdaExperience | null> {
      const response = await get(`/v1/content-experiences/path${path}`);
      return response.status === 404
        ? null
        : read(response, `content-experiences/path${path}`, cdaExperience);
    },

    /** All content items, optionally only those in the given Plate languages. */
    async items(languagePrns: readonly string[] = []): Promise<CdaItem[]> {
      const filter = languagePrns.length
        ? `&languagePrn_in=${encodeURIComponent(languagePrns.join(","))}`
        : "";
      const items: CdaItem[] = [];
      for (let page = 1; page <= MAX_PAGES; page++) {
        const body = await json(
          `/v1/content-items?page=${page}&limit=100${filter}`,
          "content-items",
          cdaItemPage,
        );
        items.push(...body.entities);
        if (page >= body.meta.pagination.totalPages) return items;
      }
      throw new CdaRequestError(`More than ${MAX_PAGES} pages of content items`);
    },
  };
}

/**
 * `Promise.all(values.map(fn))` with at most `limit` calls in flight. Results keep the input order;
 * the first rejection is returned and no new calls start after it.
 */
export async function mapLimit<T, R>(
  values: readonly T[],
  limit: number,
  fn: (value: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(values.length);
  let next = 0;
  let failed = false;
  const worker = async () => {
    while (!failed && next < values.length) {
      const index = next++;
      try {
        results[index] = await fn(values[index]!, index);
      } catch (error) {
        failed = true;
        throw error;
      }
    }
  };
  const workers = Math.max(1, Math.min(Math.floor(limit) || 1, values.length));
  await Promise.all(Array.from({ length: workers }, worker));
  return results;
}
