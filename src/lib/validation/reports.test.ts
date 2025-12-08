import { describe, it, expect } from "vitest";
import { reportsListQuerySchema, parseReportsListQuery } from "./reports";

describe("reportsListQuerySchema", () => {
  describe("valid queries with defaults", () => {
    it("should apply default values for empty query", () => {
      const result = reportsListQuerySchema.safeParse({});

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(1);
        expect(result.data.page_size).toBe(20);
        expect(result.data.sort).toBe("published_at");
        expect(result.data.order).toBe("desc");
      }
    });

    it("should accept valid page number", () => {
      const result = reportsListQuerySchema.safeParse({ page: "5" });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(5);
      }
    });

    it("should accept valid page_size", () => {
      const result = reportsListQuerySchema.safeParse({ page_size: "50" });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page_size).toBe(50);
      }
    });

    it("should accept all valid sort values", () => {
      const sortValues = ["published_at", "report_week", "title"];

      sortValues.forEach((sort) => {
        const result = reportsListQuerySchema.safeParse({ sort });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.sort).toBe(sort);
        }
      });
    });

    it("should accept both order values", () => {
      const ascResult = reportsListQuerySchema.safeParse({ order: "asc" });
      expect(ascResult.success).toBe(true);
      if (ascResult.success) {
        expect(ascResult.data.order).toBe("asc");
      }

      const descResult = reportsListQuerySchema.safeParse({ order: "desc" });
      expect(descResult.success).toBe(true);
      if (descResult.success) {
        expect(descResult.data.order).toBe("desc");
      }
    });

    it("should accept valid ISO week format", () => {
      const result = reportsListQuerySchema.safeParse({ week: "2025-W42" });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.week).toBe("2025-W42");
      }
    });

    it("should accept valid version string", () => {
      const result = reportsListQuerySchema.safeParse({ version: "1.2.3" });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.version).toBe("1.2.3");
      }
    });

    it("should accept valid ISO datetime for published_before", () => {
      const result = reportsListQuerySchema.safeParse({
        published_before: "2025-01-15T10:30:00Z",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.published_before).toBe("2025-01-15T10:30:00Z");
      }
    });

    it("should accept valid ISO datetime for published_after", () => {
      const result = reportsListQuerySchema.safeParse({
        published_after: "2025-01-01T00:00:00Z",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.published_after).toBe("2025-01-01T00:00:00Z");
      }
    });

    it("should accept all parameters together", () => {
      const result = reportsListQuerySchema.safeParse({
        page: "2",
        page_size: "30",
        sort: "report_week",
        order: "asc",
        week: "2025-W42",
        version: "2.0.0",
        published_before: "2025-12-31T23:59:59Z",
        published_after: "2025-01-01T00:00:00Z",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(2);
        expect(result.data.page_size).toBe(30);
        expect(result.data.sort).toBe("report_week");
        expect(result.data.order).toBe("asc");
        expect(result.data.week).toBe("2025-W42");
        expect(result.data.version).toBe("2.0.0");
      }
    });
  });

  describe("pagination - page validation", () => {
    it("should accept page 1 (minimum)", () => {
      const result = reportsListQuerySchema.safeParse({ page: "1" });

      expect(result.success).toBe(true);
    });

    it("should accept large page number", () => {
      const result = reportsListQuerySchema.safeParse({ page: "999" });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(999);
      }
    });

    it("should coerce string page to number", () => {
      const result = reportsListQuerySchema.safeParse({ page: "42" });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(42);
        expect(typeof result.data.page).toBe("number");
      }
    });

    it("should reject page 0", () => {
      const result = reportsListQuerySchema.safeParse({ page: "0" });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((i) => i.message.includes(">= 1"))).toBe(true);
      }
    });

    it("should reject negative page", () => {
      const result = reportsListQuerySchema.safeParse({ page: "-1" });

      expect(result.success).toBe(false);
    });

    it("should reject decimal page number", () => {
      const result = reportsListQuerySchema.safeParse({ page: "1.5" });

      expect(result.success).toBe(false);
    });

    it("should reject non-numeric page", () => {
      const result = reportsListQuerySchema.safeParse({ page: "abc" });

      expect(result.success).toBe(false);
    });

    it("should reject empty string page", () => {
      const result = reportsListQuerySchema.safeParse({ page: "" });

      expect(result.success).toBe(false);
    });
  });

  describe("pagination - page_size validation", () => {
    it("should accept page_size 1 (minimum)", () => {
      const result = reportsListQuerySchema.safeParse({ page_size: "1" });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page_size).toBe(1);
      }
    });

    it("should accept page_size 100 (maximum)", () => {
      const result = reportsListQuerySchema.safeParse({ page_size: "100" });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page_size).toBe(100);
      }
    });

    it("should accept page_size in middle range", () => {
      const result = reportsListQuerySchema.safeParse({ page_size: "50" });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page_size).toBe(50);
      }
    });

    it("should coerce string page_size to number", () => {
      const result = reportsListQuerySchema.safeParse({ page_size: "25" });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(typeof result.data.page_size).toBe("number");
      }
    });

    it("should reject page_size 0", () => {
      const result = reportsListQuerySchema.safeParse({ page_size: "0" });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((i) => i.message.includes(">= 1"))).toBe(true);
      }
    });

    it("should reject page_size above maximum (101)", () => {
      const result = reportsListQuerySchema.safeParse({ page_size: "101" });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((i) => i.message.includes("<= 100"))).toBe(true);
      }
    });

    it("should reject very large page_size", () => {
      const result = reportsListQuerySchema.safeParse({ page_size: "1000" });

      expect(result.success).toBe(false);
    });

    it("should reject negative page_size", () => {
      const result = reportsListQuerySchema.safeParse({ page_size: "-1" });

      expect(result.success).toBe(false);
    });

    it("should reject decimal page_size", () => {
      const result = reportsListQuerySchema.safeParse({ page_size: "20.5" });

      expect(result.success).toBe(false);
    });

    it("should reject non-numeric page_size", () => {
      const result = reportsListQuerySchema.safeParse({ page_size: "many" });

      expect(result.success).toBe(false);
    });
  });

  describe("sort validation", () => {
    it("should reject invalid sort value", () => {
      const result = reportsListQuerySchema.safeParse({ sort: "invalid_field" });

      expect(result.success).toBe(false);
    });

    it("should reject empty sort string", () => {
      const result = reportsListQuerySchema.safeParse({ sort: "" });

      expect(result.success).toBe(false);
    });

    it("should reject sort with typo", () => {
      const result = reportsListQuerySchema.safeParse({ sort: "published" });

      expect(result.success).toBe(false);
    });

    it("should reject case-sensitive variation", () => {
      const result = reportsListQuerySchema.safeParse({ sort: "TITLE" });

      expect(result.success).toBe(false);
    });

    it("should reject sort value from picks endpoint", () => {
      const result = reportsListQuerySchema.safeParse({ sort: "ticker" });

      expect(result.success).toBe(false);
    });

    it("should default to published_at when not provided", () => {
      const result = reportsListQuerySchema.safeParse({});

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.sort).toBe("published_at");
      }
    });
  });

  describe("order validation", () => {
    it("should reject invalid order value", () => {
      const result = reportsListQuerySchema.safeParse({ order: "invalid" });

      expect(result.success).toBe(false);
    });

    it("should reject ascending spelled out", () => {
      const result = reportsListQuerySchema.safeParse({ order: "ascending" });

      expect(result.success).toBe(false);
    });

    it("should reject descending spelled out", () => {
      const result = reportsListQuerySchema.safeParse({ order: "descending" });

      expect(result.success).toBe(false);
    });

    it("should reject uppercase order", () => {
      const result = reportsListQuerySchema.safeParse({ order: "ASC" });

      expect(result.success).toBe(false);
    });

    it("should default to desc when not provided", () => {
      const result = reportsListQuerySchema.safeParse({});

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.order).toBe("desc");
      }
    });
  });

  describe("week validation - ISO week format", () => {
    it("should accept valid ISO week for 2025", () => {
      const result = reportsListQuerySchema.safeParse({ week: "2025-W42" });

      expect(result.success).toBe(true);
    });

    it("should accept week 01", () => {
      const result = reportsListQuerySchema.safeParse({ week: "2025-W01" });

      expect(result.success).toBe(true);
    });

    it("should accept week 52", () => {
      const result = reportsListQuerySchema.safeParse({ week: "2025-W52" });

      expect(result.success).toBe(true);
    });

    it("should accept week 53 (leap week year)", () => {
      const result = reportsListQuerySchema.safeParse({ week: "2020-W53" });

      expect(result.success).toBe(true);
    });

    it("should accept past century week", () => {
      const result = reportsListQuerySchema.safeParse({ week: "1999-W52" });

      expect(result.success).toBe(true);
    });

    it("should accept future year week", () => {
      const result = reportsListQuerySchema.safeParse({ week: "2099-W30" });

      expect(result.success).toBe(true);
    });

    it("should reject week without W prefix", () => {
      const result = reportsListQuerySchema.safeParse({ week: "2025-42" });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((i) => i.message.includes("ISO week"))).toBe(true);
      }
    });

    it("should reject week with lowercase w", () => {
      const result = reportsListQuerySchema.safeParse({ week: "2025-w42" });

      expect(result.success).toBe(false);
    });

    it("should reject week with single digit", () => {
      const result = reportsListQuerySchema.safeParse({ week: "2025-W1" });

      expect(result.success).toBe(false);
    });

    it("should reject week with three digits", () => {
      const result = reportsListQuerySchema.safeParse({ week: "2025-W042" });

      expect(result.success).toBe(false);
    });

    it("should reject week without hyphen", () => {
      const result = reportsListQuerySchema.safeParse({ week: "2025W42" });

      expect(result.success).toBe(false);
    });

    it("should reject week with 2-digit year", () => {
      const result = reportsListQuerySchema.safeParse({ week: "25-W42" });

      expect(result.success).toBe(false);
    });

    it("should reject empty week string", () => {
      const result = reportsListQuerySchema.safeParse({ week: "" });

      expect(result.success).toBe(false);
    });

    it("should reject week 00", () => {
      const result = reportsListQuerySchema.safeParse({ week: "2025-W00" });

      expect(result.success).toBe(true); // Format is valid, semantic validation not enforced
    });

    it("should reject week 99", () => {
      const result = reportsListQuerySchema.safeParse({ week: "2025-W99" });

      expect(result.success).toBe(true); // Format is valid, semantic validation not enforced
    });

    it("should omit week when not provided", () => {
      const result = reportsListQuerySchema.safeParse({});

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.week).toBeUndefined();
      }
    });
  });

  describe("version validation", () => {
    it("should accept semantic version", () => {
      const result = reportsListQuerySchema.safeParse({ version: "1.2.3" });

      expect(result.success).toBe(true);
    });

    it("should accept simple version number", () => {
      const result = reportsListQuerySchema.safeParse({ version: "1" });

      expect(result.success).toBe(true);
    });

    it("should accept version with prerelease", () => {
      const result = reportsListQuerySchema.safeParse({ version: "1.0.0-alpha" });

      expect(result.success).toBe(true);
    });

    it("should accept version with build metadata", () => {
      const result = reportsListQuerySchema.safeParse({ version: "1.0.0+build.123" });

      expect(result.success).toBe(true);
    });

    it("should accept arbitrary version string", () => {
      const result = reportsListQuerySchema.safeParse({ version: "v2024.11.02" });

      expect(result.success).toBe(true);
    });

    it("should reject empty version string", () => {
      const result = reportsListQuerySchema.safeParse({ version: "" });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((i) => i.message.includes("not be empty"))).toBe(true);
      }
    });

    it("should omit version when not provided", () => {
      const result = reportsListQuerySchema.safeParse({});

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.version).toBeUndefined();
      }
    });
  });

  describe("published_before validation", () => {
    it("should accept valid ISO datetime", () => {
      const result = reportsListQuerySchema.safeParse({
        published_before: "2025-01-15T10:30:00Z",
      });

      expect(result.success).toBe(true);
    });

    it("should accept ISO datetime with offset", () => {
      const result = reportsListQuerySchema.safeParse({
        published_before: "2025-01-15T10:30:00+02:00",
      });

      expect(result.success).toBe(true);
    });

    it("should reject ISO datetime without offset (Zod requires offset or Z)", () => {
      const result = reportsListQuerySchema.safeParse({
        published_before: "2025-01-15T10:30:00",
      });

      // Zod's datetime validation requires either an offset or Z suffix
      expect(result.success).toBe(false);
    });

    it("should accept ISO datetime with milliseconds", () => {
      const result = reportsListQuerySchema.safeParse({
        published_before: "2025-01-15T10:30:00.123Z",
      });

      expect(result.success).toBe(true);
    });

    it("should reject date-only format", () => {
      const result = reportsListQuerySchema.safeParse({
        published_before: "2025-01-15",
      });

      expect(result.success).toBe(false);
    });

    it("should reject US date format", () => {
      const result = reportsListQuerySchema.safeParse({
        published_before: "01/15/2025",
      });

      expect(result.success).toBe(false);
    });

    it("should reject timestamp in milliseconds", () => {
      const result = reportsListQuerySchema.safeParse({
        published_before: "1705320600000",
      });

      expect(result.success).toBe(false);
    });

    it("should reject empty published_before", () => {
      const result = reportsListQuerySchema.safeParse({
        published_before: "",
      });

      expect(result.success).toBe(false);
    });

    it("should omit published_before when not provided", () => {
      const result = reportsListQuerySchema.safeParse({});

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.published_before).toBeUndefined();
      }
    });
  });

  describe("published_after validation", () => {
    it("should accept valid ISO datetime", () => {
      const result = reportsListQuerySchema.safeParse({
        published_after: "2025-01-01T00:00:00Z",
      });

      expect(result.success).toBe(true);
    });

    it("should accept ISO datetime with offset", () => {
      const result = reportsListQuerySchema.safeParse({
        published_after: "2025-01-01T00:00:00-05:00",
      });

      expect(result.success).toBe(true);
    });

    it("should reject ISO datetime without offset (Zod requires offset or Z)", () => {
      const result = reportsListQuerySchema.safeParse({
        published_after: "2025-01-01T00:00:00",
      });

      // Zod's datetime validation requires either an offset or Z suffix
      expect(result.success).toBe(false);
    });

    it("should accept ISO datetime with microseconds", () => {
      const result = reportsListQuerySchema.safeParse({
        published_after: "2025-01-01T00:00:00.123456Z",
      });

      expect(result.success).toBe(true);
    });

    it("should reject date-only format", () => {
      const result = reportsListQuerySchema.safeParse({
        published_after: "2025-01-01",
      });

      expect(result.success).toBe(false);
    });

    it("should reject empty published_after", () => {
      const result = reportsListQuerySchema.safeParse({
        published_after: "",
      });

      expect(result.success).toBe(false);
    });

    it("should omit published_after when not provided", () => {
      const result = reportsListQuerySchema.safeParse({});

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.published_after).toBeUndefined();
      }
    });
  });

  describe("cross-field validation - date ordering", () => {
    it("should accept when published_after is before published_before", () => {
      const result = reportsListQuerySchema.safeParse({
        published_after: "2025-01-01T00:00:00Z",
        published_before: "2025-12-31T23:59:59Z",
      });

      expect(result.success).toBe(true);
    });

    it("should accept when published_after equals published_before", () => {
      const result = reportsListQuerySchema.safeParse({
        published_after: "2025-06-15T12:00:00Z",
        published_before: "2025-06-15T12:00:00Z",
      });

      expect(result.success).toBe(true);
    });

    it("should reject when published_after is after published_before", () => {
      const result = reportsListQuerySchema.safeParse({
        published_after: "2025-12-31T23:59:59Z",
        published_before: "2025-01-01T00:00:00Z",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((i) => i.message.includes("published_after must be <= published_before"))).toBe(
          true
        );
        expect(result.error.issues.some((i) => i.path.includes("published_after"))).toBe(true);
      }
    });

    it("should reject when dates are one millisecond apart (after > before)", () => {
      const result = reportsListQuerySchema.safeParse({
        published_after: "2025-06-15T12:00:00.001Z",
        published_before: "2025-06-15T12:00:00.000Z",
      });

      expect(result.success).toBe(false);
    });

    it("should accept when only published_before is provided", () => {
      const result = reportsListQuerySchema.safeParse({
        published_before: "2025-12-31T23:59:59Z",
      });

      expect(result.success).toBe(true);
    });

    it("should accept when only published_after is provided", () => {
      const result = reportsListQuerySchema.safeParse({
        published_after: "2025-01-01T00:00:00Z",
      });

      expect(result.success).toBe(true);
    });

    it("should handle different timezones correctly", () => {
      const result = reportsListQuerySchema.safeParse({
        published_after: "2025-06-15T14:00:00+02:00", // 12:00 UTC
        published_before: "2025-06-15T12:00:00Z", // 12:00 UTC
      });

      expect(result.success).toBe(true);
    });

    it("should reject dates across timezones when after > before in UTC", () => {
      const result = reportsListQuerySchema.safeParse({
        published_after: "2025-06-15T15:00:00+02:00", // 13:00 UTC
        published_before: "2025-06-15T12:00:00Z", // 12:00 UTC
      });

      expect(result.success).toBe(false);
    });
  });
});

describe("parseReportsListQuery", () => {
  it("should parse valid URL with no query params", () => {
    const url = new URL("http://example.com/api/reports");
    const result = parseReportsListQuery(url);

    expect(result.page).toBe(1);
    expect(result.page_size).toBe(20);
    expect(result.sort).toBe("published_at");
    expect(result.order).toBe("desc");
  });

  it("should parse URL with pagination params", () => {
    const url = new URL("http://example.com/api/reports?page=3&page_size=50");
    const result = parseReportsListQuery(url);

    expect(result.page).toBe(3);
    expect(result.page_size).toBe(50);
  });

  it("should parse URL with sorting params", () => {
    const url = new URL("http://example.com/api/reports?sort=title&order=asc");
    const result = parseReportsListQuery(url);

    expect(result.sort).toBe("title");
    expect(result.order).toBe("asc");
  });

  it("should parse URL with filter params", () => {
    const url = new URL("http://example.com/api/reports?week=2025-W42&version=1.2.3");
    const result = parseReportsListQuery(url);

    expect(result.week).toBe("2025-W42");
    expect(result.version).toBe("1.2.3");
  });

  it("should parse URL with date filters", () => {
    const url = new URL(
      "http://example.com/api/reports?published_after=2025-01-01T00:00:00Z&published_before=2025-12-31T23:59:59Z"
    );
    const result = parseReportsListQuery(url);

    expect(result.published_after).toBe("2025-01-01T00:00:00Z");
    expect(result.published_before).toBe("2025-12-31T23:59:59Z");
  });

  it("should parse URL with all params", () => {
    const url = new URL(
      "http://example.com/api/reports?page=2&page_size=30&sort=report_week&order=asc&week=2025-W42&version=2.0.0&published_after=2025-06-01T00:00:00Z&published_before=2025-06-30T23:59:59Z"
    );
    const result = parseReportsListQuery(url);

    expect(result.page).toBe(2);
    expect(result.page_size).toBe(30);
    expect(result.sort).toBe("report_week");
    expect(result.order).toBe("asc");
    expect(result.week).toBe("2025-W42");
    expect(result.version).toBe("2.0.0");
    expect(result.published_after).toBe("2025-06-01T00:00:00Z");
    expect(result.published_before).toBe("2025-06-30T23:59:59Z");
  });

  it("should throw error with bad_request code for invalid page", () => {
    const url = new URL("http://example.com/api/reports?page=0");

    expect(() => parseReportsListQuery(url)).toThrow();

    try {
      parseReportsListQuery(url);
    } catch (error: any) {
      expect(error.code).toBe("bad_request");
      expect(error.message).toBeTruthy();
    }
  });

  it("should throw error with bad_request code for invalid page_size", () => {
    const url = new URL("http://example.com/api/reports?page_size=101");

    expect(() => parseReportsListQuery(url)).toThrow();

    try {
      parseReportsListQuery(url);
    } catch (error: any) {
      expect(error.code).toBe("bad_request");
      expect(error.message).toContain("100");
    }
  });

  it("should throw error with bad_request code for invalid sort", () => {
    const url = new URL("http://example.com/api/reports?sort=invalid");

    expect(() => parseReportsListQuery(url)).toThrow();

    try {
      parseReportsListQuery(url);
    } catch (error: any) {
      expect(error.code).toBe("bad_request");
    }
  });

  it("should throw error with bad_request code for invalid order", () => {
    const url = new URL("http://example.com/api/reports?order=invalid");

    expect(() => parseReportsListQuery(url)).toThrow();

    try {
      parseReportsListQuery(url);
    } catch (error: any) {
      expect(error.code).toBe("bad_request");
    }
  });

  it("should throw error with bad_request code for invalid week format", () => {
    const url = new URL("http://example.com/api/reports?week=2025-42");

    expect(() => parseReportsListQuery(url)).toThrow();

    try {
      parseReportsListQuery(url);
    } catch (error: any) {
      expect(error.code).toBe("bad_request");
      expect(error.message).toContain("ISO week");
    }
  });

  it("should throw error with bad_request code for empty version", () => {
    const url = new URL("http://example.com/api/reports?version=");

    expect(() => parseReportsListQuery(url)).toThrow();

    try {
      parseReportsListQuery(url);
    } catch (error: any) {
      expect(error.code).toBe("bad_request");
      expect(error.message).toContain("not be empty");
    }
  });

  it("should throw error with bad_request code for invalid date format", () => {
    const url = new URL("http://example.com/api/reports?published_before=2025-01-15");

    expect(() => parseReportsListQuery(url)).toThrow();

    try {
      parseReportsListQuery(url);
    } catch (error: any) {
      expect(error.code).toBe("bad_request");
    }
  });

  it("should throw error with bad_request code for invalid date ordering", () => {
    const url = new URL(
      "http://example.com/api/reports?published_after=2025-12-31T23:59:59Z&published_before=2025-01-01T00:00:00Z"
    );

    expect(() => parseReportsListQuery(url)).toThrow();

    try {
      parseReportsListQuery(url);
    } catch (error: any) {
      expect(error.code).toBe("bad_request");
      expect(error.message).toContain("published_after must be <= published_before");
    }
  });

  it("should handle URL-encoded parameters", () => {
    const url = new URL("http://example.com/api/reports?version=v2024.11.02%2Bbuild.123");
    const result = parseReportsListQuery(url);

    expect(result.version).toBe("v2024.11.02+build.123");
  });

  it("should handle URL with complex datetime encoding", () => {
    const datetime = "2025-06-15T10:30:00+02:00";
    const url = new URL(`http://example.com/api/reports?published_before=${encodeURIComponent(datetime)}`);
    const result = parseReportsListQuery(url);

    expect(result.published_before).toBe(datetime);
  });

  it("should handle multiple validation errors", () => {
    const url = new URL("http://example.com/api/reports?page=0&page_size=101&sort=invalid");

    expect(() => parseReportsListQuery(url)).toThrow();

    try {
      parseReportsListQuery(url);
    } catch (error: any) {
      expect(error.code).toBe("bad_request");
      expect(error.message).toBeTruthy();
      // Message should contain multiple errors
      expect(error.message.includes(";")).toBe(true);
    }
  });

  it("should preserve default values when parsing URL", () => {
    const url = new URL("http://example.com/api/reports?week=2025-W42");
    const result = parseReportsListQuery(url);

    // Should have defaults even though only week was provided
    expect(result.page).toBe(1);
    expect(result.page_size).toBe(20);
    expect(result.sort).toBe("published_at");
    expect(result.order).toBe("desc");
    expect(result.week).toBe("2025-W42");
  });
});
