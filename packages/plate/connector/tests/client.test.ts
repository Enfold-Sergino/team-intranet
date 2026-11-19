// The client against a fake fetch. All data is invented: this repository is public.
import { afterEach, describe, expect, it, vi } from "vitest";
import { CdaRequestError, createCdaClient, mapLimit, type CdaConfig } from "../src";

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });

const v0 = (paths: string[]) =>
  json({
    data: paths.map((path, i) => ({
      cursor: `c${i}`,
      node: { isPublished: true, pathPart: { path } },
    })),
  });

/** A fake CDA; `route` answers first, then the defaults. Returns the client and the requested URLs. */
function cda(
  route: (url: URL) => Response | undefined = () => undefined,
  extra: Partial<CdaConfig> = {},
) {
  const calls: string[] = [];
  const fetch = vi.fn(async (input: string | URL | Request) => {
    const url = new URL(String(input));
    calls.push(url.pathname + url.search);
    return (
      route(url) ??
      (url.pathname === "/v1/sitemap.xml"
        ? new Response("<urlset></urlset>")
        : url.pathname === "/v0/content-experiences"
          ? v0(["/"])
          : url.pathname === "/v1/content-items"
            ? json({ entities: [], meta: { pagination: { totalPages: 1 } } })
            : json({ message: "not found" }, 404))
    );
  });
  const client = createCdaClient({
    token: "t",
    baseUrl: "https://cda.test",
    fetch: fetch as unknown as typeof globalThis.fetch,
    sleep: async () => {},
    ...extra,
  });
  return { client, calls, fetch };
}

afterEach(() => vi.restoreAllMocks());

describe("paths", () => {
  it("combines the sitemap and the v0 list, decoding XML entities", async () => {
    const { client } = cda((url) =>
      url.pathname === "/v1/sitemap.xml"
        ? new Response("<urlset><url><loc>https://site.test/r&amp;d/</loc></url></urlset>")
        : url.pathname === "/v0/content-experiences"
          ? v0(["/", "projects"])
          : undefined,
    );
    expect((await client.paths()).sort()).toEqual(["/", "/projects", "/r&d"]);
  });

  it("fails when the v0 list fails, even on a later page", async () => {
    const first = Array.from({ length: 100 }, (_, i) => `/p${i}`);
    const { client } = cda((url) =>
      url.pathname === "/v0/content-experiences"
        ? url.searchParams.get("after")
          ? json({ message: "boom" }, 400)
          : v0(first)
        : undefined,
    );
    await expect(client.paths()).rejects.toThrow(/page 2.*HTTP 400/);
  });

  it("goes on with a warning when only the sitemap fails", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { client } = cda((url) =>
      url.pathname === "/v1/sitemap.xml" ? new Response("", { status: 500 }) : undefined,
    );
    expect(await client.paths()).toEqual(["/"]);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("Sitemap returned HTTP 500"));
  });
});

describe("experience", () => {
  it("returns null for a page that is gone and names the field of a bad response", async () => {
    const { client } = cda((url) =>
      url.pathname === "/v1/content-experiences/path/bad"
        ? json({ prn: "x", experienceComponent: {} })
        : undefined,
    );
    expect(await client.experience("/gone")).toBeNull();
    await expect(client.experience("/bad")).rejects.toThrow(
      /unexpected shape: experienceComponent\.prn/,
    );
  });
});

describe("items", () => {
  it("pages through items and filters by language", async () => {
    const { client, calls } = cda((url) =>
      url.pathname === "/v1/content-items"
        ? json({
            entities: [{ prn: `i${url.searchParams.get("page")}`, contentTypeSlug: "link" }],
            meta: { pagination: { totalPages: 2 } },
          })
        : undefined,
    );
    expect((await client.items(["prn:a", "prn:b"])).map((i) => i.prn)).toEqual(["i1", "i2"]);
    expect(calls).toContain("/v1/content-items?page=1&limit=100&languagePrn_in=prn%3Aa%2Cprn%3Ab");
  });

  it("names the field that changed", async () => {
    const { client } = cda((url) =>
      url.pathname === "/v1/content-items"
        ? json({
            entities: [{ prn: "i", contentTypeSlug: 5 }],
            meta: { pagination: { totalPages: 1 } },
          })
        : undefined,
    );
    await expect(client.items()).rejects.toThrow(
      /content-items returned an unexpected shape: entities\[0\]\.contentTypeSlug/,
    );
  });
});

describe("requests", () => {
  it("requires a token", () => {
    expect(() => createCdaClient({ token: " " })).toThrow(CdaRequestError);
  });

  it("retries 429 and 5xx, honouring Retry-After", async () => {
    let n = 0;
    const sleep = vi.fn(async () => {});
    const { client } = cda(
      (url) => {
        if (url.pathname !== "/v1/content-items") return undefined;
        n++;
        return n === 1
          ? json({}, 429, { "retry-after": "2" })
          : n === 2
            ? json({}, 503)
            : undefined;
      },
      { sleep },
    );
    await client.items();
    expect(n).toBe(3);
    expect(sleep).toHaveBeenCalledWith(2000);
  });

  it("gives up after three attempts with a clear error", async () => {
    const { client } = cda((url) =>
      url.pathname === "/v1/content-items" ? json({}, 503) : undefined,
    );
    await expect(client.items()).rejects.toThrow(/content-items returned HTTP 503/);
  });

  it("turns network errors and timeouts into a CdaRequestError", async () => {
    const fetch = vi.fn(async () => {
      throw new DOMException("The operation timed out.", "TimeoutError");
    });
    const client = createCdaClient({
      token: "t",
      fetch: fetch as unknown as typeof globalThis.fetch,
      sleep: async () => {},
    });
    const error = await client.items().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(CdaRequestError);
    expect(String(error)).toMatch(/after 3 attempts.*timed out/);
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it("sends a timeout signal with every request", async () => {
    const { client, fetch } = cda();
    await client.items();
    expect((fetch.mock.calls[0] as unknown as [string, RequestInit])[1].signal).toBeInstanceOf(
      AbortSignal,
    );
  });
});

describe("mapLimit", () => {
  it("keeps input order and never exceeds the limit", async () => {
    let running = 0;
    let peak = 0;
    const result = await mapLimit([30, 10, 20, 5, 15], 2, async (ms, i) => {
      peak = Math.max(peak, ++running);
      await new Promise((resolve) => setTimeout(resolve, ms));
      running--;
      return i;
    });
    expect(result).toEqual([0, 1, 2, 3, 4]);
    expect(peak).toBe(2);
  });

  it("rejects with the first error and starts no new calls", async () => {
    const started: number[] = [];
    const run = mapLimit([1, 2, 3], 1, async (n) => {
      started.push(n);
      if (n === 2) throw new Error("boom");
      return n;
    });
    await expect(run).rejects.toThrow("boom");
    expect(started).toEqual([1, 2]);
    expect(await mapLimit([], 4, async () => 1)).toEqual([]);
  });
});
