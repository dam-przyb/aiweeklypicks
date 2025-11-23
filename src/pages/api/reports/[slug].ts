export const prerender = false;

import type { APIRoute } from "astro";
import { parseReportSlug } from "@/lib/validation/report-by-slug";
import { getReportWithPicksBySlug } from "@/lib/services/reportBySlug";
import { hashJSON } from "@/lib/hash";

/**
 * GET /api/reports/{slug}
 * Public endpoint that fetches a single weekly report by slug with its picks.
 * Anonymous access is allowed under RLS; bearer tokens are accepted but not required.
 */
export const GET: APIRoute = async (context) => {
  const { locals, params, request } = context;

  try {
    const slug = parseReportSlug({ slug: String(params?.slug ?? "") });

    const result = await getReportWithPicksBySlug(locals.supabase, slug);
    if (!result) {
      return new Response(JSON.stringify({ code: "not_found", message: "report not found" }), {
        status: 404,
        headers: { "content-type": "application/json; charset=utf-8" },
      });
    }

    // Compute ETag from payload to support conditional GET
    const etag = `W/"${hashJSON(result)}"`;

    // If client provided If-None-Match and it matches current ETag, return 304
    const ifNoneMatch = request.headers.get("if-none-match");
    if (ifNoneMatch && ifNoneMatch === etag) {
      return new Response(null, {
        status: 304,
        headers: {
          etag: etag,
          "cache-control": "public, max-age=60, s-maxage=60, stale-while-revalidate=120",
        },
      });
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "public, max-age=60, s-maxage=60, stale-while-revalidate=120",
        etag: etag,
      },
    });
  } catch (err: any) {
    if (err?.code === "bad_request") {
      return new Response(JSON.stringify({ code: "bad_request", message: err.message || "invalid slug" }), {
        status: 400,
        headers: { "content-type": "application/json; charset=utf-8" },
      });
    }

    // Structured log for unexpected errors
    console.error("[GET /api/reports/{slug}] Unexpected error", {
      route: "/api/reports/{slug}",
      slug: params?.slug,
      error: err,
      url: request.url,
    });

    return new Response(JSON.stringify({ code: "server_error", message: "unexpected error" }), {
      status: 500,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }
};
