import type { APIRoute } from "astro";
import { getSite, options } from "../../content";
import { previewContent, type PreviewData } from "../../preview/data";

export const GET: APIRoute = async () => {
  const data: PreviewData = { options, content: previewContent((await getSite()).content) };
  return new Response(JSON.stringify({ encrypted: false, ...data }), {
    headers: { "content-type": "application/json" },
  });
};
