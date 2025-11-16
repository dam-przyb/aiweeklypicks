import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./[slug]";

// Mock dependencies
vi.mock("@/lib/validation/report-by-slug", () => ({
  parseReportSlug: vi.fn((params) => {
    if (!params.slug || params.slug === "invalid--slug") {
      const error: any = new Error("invalid slug");
      error.code = "bad_request";
      throw error;
    }
    return params.slug;
  }),
}));

vi.mock("@/lib/services/reportBySlug", () => ({
  getReportWithPicksBySlug: vi.fn(),
}));

vi.mock("@/lib/hash", () => ({
  hashJSON: vi.fn((value) => "mockhash123"),
}));

import { parseReportSlug } from "@/lib/validation/report-by-slug";
import { getReportWithPicksBySlug } from "@/lib/services/reportBySlug";
import { hashJSON } from "@/lib/hash";

describe("GET /api/reports/[slug]", () => {
  let mockContext: any;
  let mockSupabase: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockSupabase = {};

    mockContext = {
      locals: { supabase: mockSupabase },
      params: { slug: "weekly-report-2025-w42" },
      request: new Request("http://localhost:4321/api/reports/weekly-report-2025-w42"),
    };
  });

  it("should return 200 with report and picks when slug exists", async () => {
    const mockResult = {
      report: {
        report_id: "123",
        slug: "weekly-report-2025-w42",
        report_week: "2025-W42",
        published_at: "2025-10-20T00:00:00Z",
        version: "v1",
        title: "Test Report",
        summary: "Test summary",
        created_at: "2025-10-20T00:00:00Z",
      },
      picks: [
        {
          pick_id: "p1",
          report_id: "123",
          ticker: "AAPL",
          exchange: "NASDAQ",
          side: "long" as const,
          target_change_pct: 5.5,
          rationale: "Strong fundamentals",
          created_at: "2025-10-20T00:00:00Z",
        },
        {
          pick_id: "p2",
          report_id: "123",
          ticker: "TSLA",
          exchange: "NASDAQ",
          side: "short" as const,
          target_change_pct: -3.2,
          rationale: "Overvalued",
          created_at: "2025-10-20T00:00:00Z",
        },
      ],
    };

    vi.mocked(getReportWithPicksBySlug).mockResolvedValue(mockResult);

    const response = await GET(mockContext);

    expect(response.status).toBe(200);
    expect(parseReportSlug).toHaveBeenCalledWith({ slug: "weekly-report-2025-w42" });
    expect(getReportWithPicksBySlug).toHaveBeenCalledWith(mockSupabase, "weekly-report-2025-w42");

    const body = await response.json();
    expect(body).toEqual(mockResult);

    // Check headers
    expect(response.headers.get("content-type")).toBe("application/json; charset=utf-8");
    expect(response.headers.get("cache-control")).toBe(
      "public, max-age=60, s-maxage=60, stale-while-revalidate=120"
    );
    expect(response.headers.get("etag")).toBe('W/"mockhash123"');
  });

  it("should return 304 when If-None-Match matches ETag", async () => {
    const mockResult = {
      report: {
        report_id: "123",
        slug: "weekly-report-2025-w42",
        report_week: "2025-W42",
        published_at: "2025-10-20T00:00:00Z",
        version: "v1",
        title: "Test Report",
        summary: "Test summary",
        created_at: "2025-10-20T00:00:00Z",
      },
      picks: [],
    };

    vi.mocked(getReportWithPicksBySlug).mockResolvedValue(mockResult);

    // Request with If-None-Match header
    mockContext.request = new Request("http://localhost:4321/api/reports/weekly-report-2025-w42", {
      headers: { "if-none-match": 'W/"mockhash123"' },
    });

    const response = await GET(mockContext);

    expect(response.status).toBe(304);
    expect(response.headers.get("etag")).toBe('W/"mockhash123"');
    expect(response.headers.get("cache-control")).toBe(
      "public, max-age=60, s-maxage=60, stale-while-revalidate=120"
    );

    // Body should be empty for 304
    const text = await response.text();
    expect(text).toBe("");
  });

  it("should return 404 when slug does not exist", async () => {
    vi.mocked(getReportWithPicksBySlug).mockResolvedValue(null);

    const response = await GET(mockContext);

    expect(response.status).toBe(404);

    const body = await response.json();
    expect(body).toEqual({
      code: "not_found",
      message: "report not found",
    });
  });

  it("should return 400 when slug is invalid", async () => {
    mockContext.params.slug = "invalid--slug";

    const response = await GET(mockContext);

    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.code).toBe("bad_request");
    expect(body.message).toBeTruthy();
  });

  it("should return 400 when slug is empty", async () => {
    mockContext.params.slug = "";

    const response = await GET(mockContext);

    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.code).toBe("bad_request");
  });

  it("should return 500 when service throws unexpected error", async () => {
    vi.mocked(getReportWithPicksBySlug).mockRejectedValue(new Error("Database connection failed"));

    const response = await GET(mockContext);

    expect(response.status).toBe(500);

    const body = await response.json();
    expect(body).toEqual({
      code: "server_error",
      message: "unexpected error",
    });
  });

  it("should ensure picks are ordered (via service)", async () => {
    const mockResult = {
      report: {
        report_id: "123",
        slug: "test-report",
        report_week: "2025-W42",
        published_at: "2025-10-20T00:00:00Z",
        version: "v1",
        title: "Test",
        summary: "Summary",
        created_at: "2025-10-20T00:00:00Z",
      },
      picks: [
        {
          pick_id: "p1",
          report_id: "123",
          ticker: "AAPL",
          exchange: "NASDAQ",
          side: "long" as const,
          target_change_pct: 5.5,
          rationale: "Buy",
          created_at: "2025-10-20T00:00:00Z",
        },
        {
          pick_id: "p2",
          report_id: "123",
          ticker: "AAPL",
          exchange: "NASDAQ",
          side: "short" as const,
          target_change_pct: -2.0,
          rationale: "Sell",
          created_at: "2025-10-20T00:00:00Z",
        },
        {
          pick_id: "p3",
          report_id: "123",
          ticker: "TSLA",
          exchange: "NASDAQ",
          side: "long" as const,
          target_change_pct: 10.0,
          rationale: "Strong buy",
          created_at: "2025-10-20T00:00:00Z",
        },
      ],
    };

    vi.mocked(getReportWithPicksBySlug).mockResolvedValue(mockResult);

    const response = await GET(mockContext);
    const body = await response.json();

    // Verify picks array is present (ordering is service responsibility)
    expect(body.picks).toHaveLength(3);
    expect(body.picks[0].ticker).toBe("AAPL");
    expect(body.picks[0].side).toBe("long");
    expect(body.picks[1].ticker).toBe("AAPL");
    expect(body.picks[1].side).toBe("short");
    expect(body.picks[2].ticker).toBe("TSLA");
  });
});

