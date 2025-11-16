import { describe, it, expect } from "vitest";
import { parseReportSlug, reportSlugSchema } from "./report-by-slug";

describe("reportSlugSchema", () => {
  it("should accept valid lowercase slug with hyphens", () => {
    const result = reportSlugSchema.safeParse({ slug: "weekly-report-2025-w42" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.slug).toBe("weekly-report-2025-w42");
    }
  });

  it("should accept single character slug", () => {
    const result = reportSlugSchema.safeParse({ slug: "a" });
    expect(result.success).toBe(true);
  });

  it("should accept slug with only digits", () => {
    const result = reportSlugSchema.safeParse({ slug: "2025" });
    expect(result.success).toBe(true);
  });

  it("should accept slug at max length (120 chars)", () => {
    const slug = "a".repeat(120);
    const result = reportSlugSchema.safeParse({ slug });
    expect(result.success).toBe(true);
  });

  it("should reject empty string", () => {
    const result = reportSlugSchema.safeParse({ slug: "" });
    expect(result.success).toBe(false);
  });

  it("should reject slug exceeding max length (121 chars)", () => {
    const slug = "a".repeat(121);
    const result = reportSlugSchema.safeParse({ slug });
    expect(result.success).toBe(false);
  });

  it("should reject slug with uppercase letters", () => {
    const result = reportSlugSchema.safeParse({ slug: "Weekly-Report" });
    expect(result.success).toBe(false);
  });

  it("should reject slug with leading hyphen", () => {
    const result = reportSlugSchema.safeParse({ slug: "-weekly-report" });
    expect(result.success).toBe(false);
  });

  it("should reject slug with trailing hyphen", () => {
    const result = reportSlugSchema.safeParse({ slug: "weekly-report-" });
    expect(result.success).toBe(false);
  });

  it("should reject slug with consecutive hyphens", () => {
    const result = reportSlugSchema.safeParse({ slug: "weekly--report" });
    expect(result.success).toBe(false);
  });

  it("should reject slug with special characters", () => {
    const result = reportSlugSchema.safeParse({ slug: "weekly_report" });
    expect(result.success).toBe(false);
  });

  it("should reject slug with spaces", () => {
    const result = reportSlugSchema.safeParse({ slug: "weekly report" });
    expect(result.success).toBe(false);
  });

  it("should reject slug with dots", () => {
    const result = reportSlugSchema.safeParse({ slug: "weekly.report" });
    expect(result.success).toBe(false);
  });
});

describe("parseReportSlug", () => {
  it("should return slug string for valid input", () => {
    const slug = parseReportSlug({ slug: "weekly-report-2025-w42" });
    expect(slug).toBe("weekly-report-2025-w42");
  });

  it("should throw error with bad_request code for invalid slug", () => {
    expect(() => parseReportSlug({ slug: "Invalid-Slug" })).toThrow();
    try {
      parseReportSlug({ slug: "Invalid-Slug" });
    } catch (err: any) {
      expect(err.code).toBe("bad_request");
      expect(err.message).toBeTruthy();
    }
  });

  it("should throw error with bad_request code for empty slug", () => {
    expect(() => parseReportSlug({ slug: "" })).toThrow();
    try {
      parseReportSlug({ slug: "" });
    } catch (err: any) {
      expect(err.code).toBe("bad_request");
    }
  });

  it("should throw error with bad_request code for slug exceeding max length", () => {
    const slug = "a".repeat(121);
    expect(() => parseReportSlug({ slug })).toThrow();
    try {
      parseReportSlug({ slug });
    } catch (err: any) {
      expect(err.code).toBe("bad_request");
    }
  });

  it("should throw error with bad_request code for slug with special chars", () => {
    expect(() => parseReportSlug({ slug: "weekly_report@123" })).toThrow();
    try {
      parseReportSlug({ slug: "weekly_report@123" });
    } catch (err: any) {
      expect(err.code).toBe("bad_request");
    }
  });
});

