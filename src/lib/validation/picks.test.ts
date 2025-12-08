import { describe, it, expect } from "vitest";
import { picksListQuerySchema, parsePicksListQuery } from "./picks";

describe("picksListQuerySchema", () => {
  describe("valid queries with defaults", () => {
    it("should apply default values for empty query", () => {
      const result = picksListQuerySchema.safeParse({});

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(1);
        expect(result.data.page_size).toBe(20);
        expect(result.data.sort).toBe("published_at");
        expect(result.data.order).toBe("desc");
      }
    });

    it("should accept valid page number", () => {
      const result = picksListQuerySchema.safeParse({ page: "5" });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(5);
      }
    });

    it("should accept valid page_size", () => {
      const result = picksListQuerySchema.safeParse({ page_size: "50" });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page_size).toBe(50);
      }
    });

    it("should accept all valid sort values", () => {
      const sortValues = ["published_at", "ticker", "exchange", "side", "target_change_pct"];

      sortValues.forEach((sort) => {
        const result = picksListQuerySchema.safeParse({ sort });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.sort).toBe(sort);
        }
      });
    });

    it("should accept both order values", () => {
      const ascResult = picksListQuerySchema.safeParse({ order: "asc" });
      expect(ascResult.success).toBe(true);
      if (ascResult.success) {
        expect(ascResult.data.order).toBe("asc");
      }

      const descResult = picksListQuerySchema.safeParse({ order: "desc" });
      expect(descResult.success).toBe(true);
      if (descResult.success) {
        expect(descResult.data.order).toBe("desc");
      }
    });

    it("should accept valid ticker filter", () => {
      const result = picksListQuerySchema.safeParse({ ticker: "AAPL" });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.ticker).toBe("AAPL");
      }
    });

    it("should accept valid exchange filter", () => {
      const result = picksListQuerySchema.safeParse({ exchange: "NYSE" });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.exchange).toBe("NYSE");
      }
    });

    it("should accept both side values", () => {
      const longResult = picksListQuerySchema.safeParse({ side: "long" });
      expect(longResult.success).toBe(true);
      if (longResult.success) {
        expect(longResult.data.side).toBe("long");
      }

      const shortResult = picksListQuerySchema.safeParse({ side: "short" });
      expect(shortResult.success).toBe(true);
      if (shortResult.success) {
        expect(shortResult.data.side).toBe("short");
      }
    });

    it("should accept valid ISO datetime for date_before", () => {
      const result = picksListQuerySchema.safeParse({
        date_before: "2025-01-15T10:30:00Z",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.date_before).toBe("2025-01-15T10:30:00Z");
      }
    });

    it("should accept valid ISO datetime for date_after", () => {
      const result = picksListQuerySchema.safeParse({
        date_after: "2025-01-01T00:00:00Z",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.date_after).toBe("2025-01-01T00:00:00Z");
      }
    });

    it("should accept ISO datetime with offset", () => {
      const result = picksListQuerySchema.safeParse({
        date_before: "2025-01-15T10:30:00+02:00",
      });

      expect(result.success).toBe(true);
    });

    it("should reject ISO datetime without offset (Zod requires offset or Z)", () => {
      const result = picksListQuerySchema.safeParse({
        date_before: "2025-01-15T10:30:00",
      });

      // Zod's datetime validation requires either an offset or Z suffix
      expect(result.success).toBe(false);
    });

    it("should accept all parameters together", () => {
      const result = picksListQuerySchema.safeParse({
        page: "2",
        page_size: "30",
        sort: "ticker",
        order: "asc",
        ticker: "MSFT",
        exchange: "NASDAQ",
        side: "long",
        date_before: "2025-12-31T23:59:59Z",
        date_after: "2025-01-01T00:00:00Z",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(2);
        expect(result.data.page_size).toBe(30);
        expect(result.data.sort).toBe("ticker");
        expect(result.data.order).toBe("asc");
        expect(result.data.ticker).toBe("MSFT");
        expect(result.data.exchange).toBe("NASDAQ");
        expect(result.data.side).toBe("long");
      }
    });
  });

  describe("pagination - page validation", () => {
    it("should accept page 1", () => {
      const result = picksListQuerySchema.safeParse({ page: "1" });

      expect(result.success).toBe(true);
    });

    it("should accept large page number", () => {
      const result = picksListQuerySchema.safeParse({ page: "999" });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(999);
      }
    });

    it("should coerce string page to number", () => {
      const result = picksListQuerySchema.safeParse({ page: "42" });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(42);
        expect(typeof result.data.page).toBe("number");
      }
    });

    it("should reject page 0", () => {
      const result = picksListQuerySchema.safeParse({ page: "0" });

      expect(result.success).toBe(false);
    });

    it("should reject negative page", () => {
      const result = picksListQuerySchema.safeParse({ page: "-1" });

      expect(result.success).toBe(false);
    });

    it("should reject decimal page number", () => {
      const result = picksListQuerySchema.safeParse({ page: "1.5" });

      expect(result.success).toBe(false);
    });

    it("should reject non-numeric page", () => {
      const result = picksListQuerySchema.safeParse({ page: "abc" });

      expect(result.success).toBe(false);
    });

    it("should reject empty string page", () => {
      const result = picksListQuerySchema.safeParse({ page: "" });

      expect(result.success).toBe(false);
    });
  });

  describe("pagination - page_size validation", () => {
    it("should accept page_size 1", () => {
      const result = picksListQuerySchema.safeParse({ page_size: "1" });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page_size).toBe(1);
      }
    });

    it("should accept page_size 100 (maximum)", () => {
      const result = picksListQuerySchema.safeParse({ page_size: "100" });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page_size).toBe(100);
      }
    });

    it("should accept page_size in middle range", () => {
      const result = picksListQuerySchema.safeParse({ page_size: "50" });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page_size).toBe(50);
      }
    });

    it("should coerce string page_size to number", () => {
      const result = picksListQuerySchema.safeParse({ page_size: "25" });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(typeof result.data.page_size).toBe("number");
      }
    });

    it("should reject page_size 0", () => {
      const result = picksListQuerySchema.safeParse({ page_size: "0" });

      expect(result.success).toBe(false);
    });

    it("should reject page_size above maximum (101)", () => {
      const result = picksListQuerySchema.safeParse({ page_size: "101" });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((i) => i.message.includes("100"))).toBe(true);
      }
    });

    it("should reject very large page_size", () => {
      const result = picksListQuerySchema.safeParse({ page_size: "1000" });

      expect(result.success).toBe(false);
    });

    it("should reject negative page_size", () => {
      const result = picksListQuerySchema.safeParse({ page_size: "-1" });

      expect(result.success).toBe(false);
    });

    it("should reject decimal page_size", () => {
      const result = picksListQuerySchema.safeParse({ page_size: "20.5" });

      expect(result.success).toBe(false);
    });

    it("should reject non-numeric page_size", () => {
      const result = picksListQuerySchema.safeParse({ page_size: "many" });

      expect(result.success).toBe(false);
    });
  });

  describe("sort validation", () => {
    it("should reject invalid sort value", () => {
      const result = picksListQuerySchema.safeParse({ sort: "invalid_field" });

      expect(result.success).toBe(false);
    });

    it("should reject empty sort string", () => {
      const result = picksListQuerySchema.safeParse({ sort: "" });

      expect(result.success).toBe(false);
    });

    it("should reject sort with typo", () => {
      const result = picksListQuerySchema.safeParse({ sort: "tickr" });

      expect(result.success).toBe(false);
    });

    it("should reject case-sensitive variation", () => {
      const result = picksListQuerySchema.safeParse({ sort: "TICKER" });

      expect(result.success).toBe(false);
    });

    it("should default to published_at when not provided", () => {
      const result = picksListQuerySchema.safeParse({});

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.sort).toBe("published_at");
      }
    });
  });

  describe("order validation", () => {
    it("should reject invalid order value", () => {
      const result = picksListQuerySchema.safeParse({ order: "invalid" });

      expect(result.success).toBe(false);
    });

    it("should reject ascending spelled out", () => {
      const result = picksListQuerySchema.safeParse({ order: "ascending" });

      expect(result.success).toBe(false);
    });

    it("should reject descending spelled out", () => {
      const result = picksListQuerySchema.safeParse({ order: "descending" });

      expect(result.success).toBe(false);
    });

    it("should reject uppercase order", () => {
      const result = picksListQuerySchema.safeParse({ order: "ASC" });

      expect(result.success).toBe(false);
    });

    it("should default to desc when not provided", () => {
      const result = picksListQuerySchema.safeParse({});

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.order).toBe("desc");
      }
    });
  });

  describe("ticker validation", () => {
    it("should reject empty ticker", () => {
      const result = picksListQuerySchema.safeParse({ ticker: "" });

      expect(result.success).toBe(false);
    });

    it("should accept ticker with numbers", () => {
      const result = picksListQuerySchema.safeParse({ ticker: "BRK.B" });

      expect(result.success).toBe(true);
    });

    it("should accept lowercase ticker", () => {
      const result = picksListQuerySchema.safeParse({ ticker: "aapl" });

      expect(result.success).toBe(true);
    });

    it("should omit ticker when not provided", () => {
      const result = picksListQuerySchema.safeParse({});

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.ticker).toBeUndefined();
      }
    });
  });

  describe("exchange validation", () => {
    it("should reject empty exchange", () => {
      const result = picksListQuerySchema.safeParse({ exchange: "" });

      expect(result.success).toBe(false);
    });

    it("should accept lowercase exchange", () => {
      const result = picksListQuerySchema.safeParse({ exchange: "nyse" });

      expect(result.success).toBe(true);
    });

    it("should accept exchange with dots", () => {
      const result = picksListQuerySchema.safeParse({ exchange: "NASDAQ.US" });

      expect(result.success).toBe(true);
    });

    it("should omit exchange when not provided", () => {
      const result = picksListQuerySchema.safeParse({});

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.exchange).toBeUndefined();
      }
    });
  });

  describe("side validation", () => {
    it("should reject invalid side value", () => {
      const result = picksListQuerySchema.safeParse({ side: "buy" });

      expect(result.success).toBe(false);
    });

    it("should reject uppercase side", () => {
      const result = picksListQuerySchema.safeParse({ side: "LONG" });

      expect(result.success).toBe(false);
    });

    it("should reject empty side", () => {
      const result = picksListQuerySchema.safeParse({ side: "" });

      expect(result.success).toBe(false);
    });

    it("should omit side when not provided", () => {
      const result = picksListQuerySchema.safeParse({});

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.side).toBeUndefined();
      }
    });
  });

  describe("date_before validation", () => {
    it("should reject invalid ISO datetime", () => {
      const result = picksListQuerySchema.safeParse({
        date_before: "2025-01-15",
      });

      expect(result.success).toBe(false);
    });

    it("should reject date in wrong format", () => {
      const result = picksListQuerySchema.safeParse({
        date_before: "01/15/2025",
      });

      expect(result.success).toBe(false);
    });

    it("should reject timestamp in milliseconds", () => {
      const result = picksListQuerySchema.safeParse({
        date_before: "1705320600000",
      });

      expect(result.success).toBe(false);
    });

    it("should reject empty date_before", () => {
      const result = picksListQuerySchema.safeParse({
        date_before: "",
      });

      expect(result.success).toBe(false);
    });

    it("should accept microseconds precision", () => {
      const result = picksListQuerySchema.safeParse({
        date_before: "2025-01-15T10:30:00.123456Z",
      });

      expect(result.success).toBe(true);
    });
  });

  describe("date_after validation", () => {
    it("should reject invalid ISO datetime", () => {
      const result = picksListQuerySchema.safeParse({
        date_after: "2025-01-15",
      });

      expect(result.success).toBe(false);
    });

    it("should reject date in wrong format", () => {
      const result = picksListQuerySchema.safeParse({
        date_after: "01/15/2025",
      });

      expect(result.success).toBe(false);
    });

    it("should reject empty date_after", () => {
      const result = picksListQuerySchema.safeParse({
        date_after: "",
      });

      expect(result.success).toBe(false);
    });

    it("should accept milliseconds precision", () => {
      const result = picksListQuerySchema.safeParse({
        date_after: "2025-01-15T10:30:00.123Z",
      });

      expect(result.success).toBe(true);
    });
  });

  describe("cross-field validation - date ordering", () => {
    it("should accept when date_after is before date_before", () => {
      const result = picksListQuerySchema.safeParse({
        date_after: "2025-01-01T00:00:00Z",
        date_before: "2025-12-31T23:59:59Z",
      });

      expect(result.success).toBe(true);
    });

    it("should accept when date_after equals date_before", () => {
      const result = picksListQuerySchema.safeParse({
        date_after: "2025-06-15T12:00:00Z",
        date_before: "2025-06-15T12:00:00Z",
      });

      expect(result.success).toBe(true);
    });

    it("should reject when date_after is after date_before", () => {
      const result = picksListQuerySchema.safeParse({
        date_after: "2025-12-31T23:59:59Z",
        date_before: "2025-01-01T00:00:00Z",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((i) => i.message.includes("date_after must be <= date_before"))).toBe(true);
        expect(result.error.issues.some((i) => i.path.includes("date_after"))).toBe(true);
      }
    });

    it("should reject when dates are one second apart (after > before)", () => {
      const result = picksListQuerySchema.safeParse({
        date_after: "2025-06-15T12:00:01Z",
        date_before: "2025-06-15T12:00:00Z",
      });

      expect(result.success).toBe(false);
    });

    it("should accept when only date_before is provided", () => {
      const result = picksListQuerySchema.safeParse({
        date_before: "2025-12-31T23:59:59Z",
      });

      expect(result.success).toBe(true);
    });

    it("should accept when only date_after is provided", () => {
      const result = picksListQuerySchema.safeParse({
        date_after: "2025-01-01T00:00:00Z",
      });

      expect(result.success).toBe(true);
    });

    it("should handle different timezones correctly", () => {
      const result = picksListQuerySchema.safeParse({
        date_after: "2025-06-15T12:00:00+02:00", // 10:00 UTC
        date_before: "2025-06-15T12:00:00Z", // 12:00 UTC
      });

      expect(result.success).toBe(true);
    });
  });
});

describe("parsePicksListQuery", () => {
  it("should parse valid URL with no query params", () => {
    const url = new URL("http://example.com/api/picks");
    const result = parsePicksListQuery(url);

    expect(result.page).toBe(1);
    expect(result.page_size).toBe(20);
    expect(result.sort).toBe("published_at");
    expect(result.order).toBe("desc");
  });

  it("should parse URL with pagination params", () => {
    const url = new URL("http://example.com/api/picks?page=3&page_size=50");
    const result = parsePicksListQuery(url);

    expect(result.page).toBe(3);
    expect(result.page_size).toBe(50);
  });

  it("should parse URL with sorting params", () => {
    const url = new URL("http://example.com/api/picks?sort=ticker&order=asc");
    const result = parsePicksListQuery(url);

    expect(result.sort).toBe("ticker");
    expect(result.order).toBe("asc");
  });

  it("should parse URL with filter params", () => {
    const url = new URL("http://example.com/api/picks?ticker=AAPL&exchange=NASDAQ&side=long");
    const result = parsePicksListQuery(url);

    expect(result.ticker).toBe("AAPL");
    expect(result.exchange).toBe("NASDAQ");
    expect(result.side).toBe("long");
  });

  it("should parse URL with date filters", () => {
    const url = new URL(
      "http://example.com/api/picks?date_after=2025-01-01T00:00:00Z&date_before=2025-12-31T23:59:59Z"
    );
    const result = parsePicksListQuery(url);

    expect(result.date_after).toBe("2025-01-01T00:00:00Z");
    expect(result.date_before).toBe("2025-12-31T23:59:59Z");
  });

  it("should parse URL with all params", () => {
    const url = new URL(
      "http://example.com/api/picks?page=2&page_size=30&sort=exchange&order=asc&ticker=MSFT&exchange=NYSE&side=short&date_after=2025-06-01T00:00:00Z&date_before=2025-06-30T23:59:59Z"
    );
    const result = parsePicksListQuery(url);

    expect(result.page).toBe(2);
    expect(result.page_size).toBe(30);
    expect(result.sort).toBe("exchange");
    expect(result.order).toBe("asc");
    expect(result.ticker).toBe("MSFT");
    expect(result.exchange).toBe("NYSE");
    expect(result.side).toBe("short");
    expect(result.date_after).toBe("2025-06-01T00:00:00Z");
    expect(result.date_before).toBe("2025-06-30T23:59:59Z");
  });

  it("should throw error with bad_request code for invalid page", () => {
    const url = new URL("http://example.com/api/picks?page=0");

    expect(() => parsePicksListQuery(url)).toThrow();

    try {
      parsePicksListQuery(url);
    } catch (error: any) {
      expect(error.code).toBe("bad_request");
      expect(error.message).toBeTruthy();
    }
  });

  it("should throw error with bad_request code for invalid page_size", () => {
    const url = new URL("http://example.com/api/picks?page_size=101");

    expect(() => parsePicksListQuery(url)).toThrow();

    try {
      parsePicksListQuery(url);
    } catch (error: any) {
      expect(error.code).toBe("bad_request");
      expect(error.message).toContain("100");
    }
  });

  it("should throw error with bad_request code for invalid sort", () => {
    const url = new URL("http://example.com/api/picks?sort=invalid");

    expect(() => parsePicksListQuery(url)).toThrow();

    try {
      parsePicksListQuery(url);
    } catch (error: any) {
      expect(error.code).toBe("bad_request");
    }
  });

  it("should throw error with bad_request code for invalid order", () => {
    const url = new URL("http://example.com/api/picks?order=invalid");

    expect(() => parsePicksListQuery(url)).toThrow();

    try {
      parsePicksListQuery(url);
    } catch (error: any) {
      expect(error.code).toBe("bad_request");
    }
  });

  it("should throw error with bad_request code for invalid side", () => {
    const url = new URL("http://example.com/api/picks?side=buy");

    expect(() => parsePicksListQuery(url)).toThrow();

    try {
      parsePicksListQuery(url);
    } catch (error: any) {
      expect(error.code).toBe("bad_request");
    }
  });

  it("should throw error with bad_request code for invalid date format", () => {
    const url = new URL("http://example.com/api/picks?date_before=2025-01-15");

    expect(() => parsePicksListQuery(url)).toThrow();

    try {
      parsePicksListQuery(url);
    } catch (error: any) {
      expect(error.code).toBe("bad_request");
    }
  });

  it("should throw error with bad_request code for invalid date ordering", () => {
    const url = new URL(
      "http://example.com/api/picks?date_after=2025-12-31T23:59:59Z&date_before=2025-01-01T00:00:00Z"
    );

    expect(() => parsePicksListQuery(url)).toThrow();

    try {
      parsePicksListQuery(url);
    } catch (error: any) {
      expect(error.code).toBe("bad_request");
      expect(error.message).toContain("date_after must be <= date_before");
    }
  });

  it("should throw error with bad_request code for empty ticker", () => {
    const url = new URL("http://example.com/api/picks?ticker=");

    expect(() => parsePicksListQuery(url)).toThrow();

    try {
      parsePicksListQuery(url);
    } catch (error: any) {
      expect(error.code).toBe("bad_request");
    }
  });

  it("should handle URL-encoded parameters", () => {
    const url = new URL("http://example.com/api/picks?ticker=BRK.B&exchange=NYSE%2FNYSE");
    const result = parsePicksListQuery(url);

    expect(result.ticker).toBe("BRK.B");
    expect(result.exchange).toBe("NYSE/NYSE");
  });

  it("should handle URL with complex datetime encoding", () => {
    const datetime = "2025-06-15T10:30:00+02:00";
    const url = new URL(`http://example.com/api/picks?date_before=${encodeURIComponent(datetime)}`);
    const result = parsePicksListQuery(url);

    expect(result.date_before).toBe(datetime);
  });
});
