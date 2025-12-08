import { describe, it, expect } from "vitest";
import {
  filenameSchema,
  jsonVariantSchema,
  MAX_PAYLOAD_SIZE,
  isPayloadSizeValid,
  calculatePayloadSize,
} from "./imports";

describe("filenameSchema", () => {
  describe("valid filenames", () => {
    it("should accept valid filename in format YYYY-MM-DDreport.json", () => {
      const result = filenameSchema.safeParse("2024-11-02report.json");

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe("2024-11-02report.json");
      }
    });

    it("should accept filename with different year", () => {
      const result = filenameSchema.safeParse("2025-01-15report.json");

      expect(result.success).toBe(true);
    });

    it("should accept filename with end of year date", () => {
      const result = filenameSchema.safeParse("2024-12-31report.json");

      expect(result.success).toBe(true);
    });

    it("should accept filename with start of year date", () => {
      const result = filenameSchema.safeParse("2024-01-01report.json");

      expect(result.success).toBe(true);
    });

    it("should accept filename from past century", () => {
      const result = filenameSchema.safeParse("1999-12-31report.json");

      expect(result.success).toBe(true);
    });

    it("should accept filename from future year", () => {
      const result = filenameSchema.safeParse("2099-06-15report.json");

      expect(result.success).toBe(true);
    });
  });

  describe("invalid filenames - format violations", () => {
    it("should reject filename with wrong extension", () => {
      const result = filenameSchema.safeParse("2024-11-02report.txt");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((i) => i.message.includes("YYYY-MM-DDreport.json"))).toBe(true);
      }
    });

    it("should reject filename without extension", () => {
      const result = filenameSchema.safeParse("2024-11-02report");

      expect(result.success).toBe(false);
    });

    it("should reject filename with spaces in date", () => {
      const result = filenameSchema.safeParse("2024 11 02report.json");

      expect(result.success).toBe(false);
    });

    it("should reject filename with dashes in wrong places", () => {
      const result = filenameSchema.safeParse("2024-1-2report.json");

      expect(result.success).toBe(false);
    });

    it("should reject filename with underscores instead of hyphens", () => {
      const result = filenameSchema.safeParse("2024_11_02report.json");

      expect(result.success).toBe(false);
    });

    it("should reject filename with space before report", () => {
      const result = filenameSchema.safeParse("2024-11-02 report.json");

      expect(result.success).toBe(false);
    });

    it("should reject filename with hyphen between date and report", () => {
      const result = filenameSchema.safeParse("2024-11-02-report.json");

      expect(result.success).toBe(false);
    });

    it("should reject filename with missing 'report' prefix", () => {
      const result = filenameSchema.safeParse("2024-11-02.json");

      expect(result.success).toBe(false);
    });

    it("should reject filename with uppercase extension", () => {
      const result = filenameSchema.safeParse("2024-11-02report.JSON");

      expect(result.success).toBe(false);
    });

    it("should reject filename with uppercase 'REPORT'", () => {
      const result = filenameSchema.safeParse("2024-11-02REPORT.json");

      expect(result.success).toBe(false);
    });
  });

  describe("invalid filenames - date format violations", () => {
    it("should reject filename with 2-digit year", () => {
      const result = filenameSchema.safeParse("24-11-02report.json");

      expect(result.success).toBe(false);
    });

    it("should reject filename with 5-digit year", () => {
      const result = filenameSchema.safeParse("20245-11-02report.json");

      expect(result.success).toBe(false);
    });

    it("should reject filename with single-digit month", () => {
      const result = filenameSchema.safeParse("2024-1-02report.json");

      expect(result.success).toBe(false);
    });

    it("should reject filename with single-digit day", () => {
      const result = filenameSchema.safeParse("2024-11-2report.json");

      expect(result.success).toBe(false);
    });

    it("should reject filename with 3-digit month", () => {
      const result = filenameSchema.safeParse("2024-111-02report.json");

      expect(result.success).toBe(false);
    });

    it("should reject filename with 3-digit day", () => {
      const result = filenameSchema.safeParse("2024-11-022report.json");

      expect(result.success).toBe(false);
    });

    it("should reject filename with non-numeric year", () => {
      const result = filenameSchema.safeParse("YYYY-11-02report.json");

      expect(result.success).toBe(false);
    });

    it("should reject filename with non-numeric month", () => {
      const result = filenameSchema.safeParse("2024-MM-02report.json");

      expect(result.success).toBe(false);
    });

    it("should reject filename with non-numeric day", () => {
      const result = filenameSchema.safeParse("2024-11-DDreport.json");

      expect(result.success).toBe(false);
    });
  });

  describe("invalid filenames - edge cases", () => {
    it("should reject empty string", () => {
      const result = filenameSchema.safeParse("");

      expect(result.success).toBe(false);
    });

    it("should reject filename with only date", () => {
      const result = filenameSchema.safeParse("2024-11-02");

      expect(result.success).toBe(false);
    });

    it("should reject filename with additional prefix", () => {
      const result = filenameSchema.safeParse("prefix-2024-11-02report.json");

      expect(result.success).toBe(false);
    });

    it("should reject filename with additional suffix", () => {
      const result = filenameSchema.safeParse("2024-11-02report-suffix.json");

      expect(result.success).toBe(false);
    });

    it("should reject non-string input", () => {
      const result = filenameSchema.safeParse(12345);

      expect(result.success).toBe(false);
    });

    it("should reject null", () => {
      const result = filenameSchema.safeParse(null);

      expect(result.success).toBe(false);
    });

    it("should reject undefined", () => {
      const result = filenameSchema.safeParse(undefined);

      expect(result.success).toBe(false);
    });
  });

  describe("date validation boundaries", () => {
    it("should accept month 01 (January)", () => {
      const result = filenameSchema.safeParse("2024-01-15report.json");

      expect(result.success).toBe(true);
    });

    it("should accept month 12 (December)", () => {
      const result = filenameSchema.safeParse("2024-12-15report.json");

      expect(result.success).toBe(true);
    });

    it("should accept day 01", () => {
      const result = filenameSchema.safeParse("2024-06-01report.json");

      expect(result.success).toBe(true);
    });

    it("should accept day 31", () => {
      const result = filenameSchema.safeParse("2024-01-31report.json");

      expect(result.success).toBe(true);
    });

    it("should accept syntactically valid but logically invalid dates (schema only checks format)", () => {
      // Note: The schema only validates format, not date validity
      // 2024-02-30 is not a real date, but matches the format
      const result = filenameSchema.safeParse("2024-02-30report.json");

      expect(result.success).toBe(true);
    });

    it("should accept month 00 (invalid but matches format)", () => {
      // Schema validates format, not semantic validity
      const result = filenameSchema.safeParse("2024-00-15report.json");

      expect(result.success).toBe(true);
    });

    it("should accept month 13 (invalid but matches format)", () => {
      // Schema validates format, not semantic validity
      const result = filenameSchema.safeParse("2024-13-15report.json");

      expect(result.success).toBe(true);
    });
  });
});

describe("jsonVariantSchema", () => {
  describe("valid payloads", () => {
    it("should accept valid JSON variant with filename and payload", () => {
      const input = {
        filename: "2024-11-02report.json",
        payload: { data: "test" },
      };

      const result = jsonVariantSchema.safeParse(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.filename).toBe("2024-11-02report.json");
        expect(result.data.payload).toEqual({ data: "test" });
      }
    });

    it("should accept payload as object", () => {
      const input = {
        filename: "test.json",
        payload: { key: "value", nested: { data: 123 } },
      };

      const result = jsonVariantSchema.safeParse(input);

      expect(result.success).toBe(true);
    });

    it("should accept payload as array", () => {
      const input = {
        filename: "test.json",
        payload: [1, 2, 3, 4],
      };

      const result = jsonVariantSchema.safeParse(input);

      expect(result.success).toBe(true);
    });

    it("should accept payload as string", () => {
      const input = {
        filename: "test.json",
        payload: "string payload",
      };

      const result = jsonVariantSchema.safeParse(input);

      expect(result.success).toBe(true);
    });

    it("should accept payload as number", () => {
      const input = {
        filename: "test.json",
        payload: 42,
      };

      const result = jsonVariantSchema.safeParse(input);

      expect(result.success).toBe(true);
    });

    it("should accept payload as boolean", () => {
      const input = {
        filename: "test.json",
        payload: true,
      };

      const result = jsonVariantSchema.safeParse(input);

      expect(result.success).toBe(true);
    });

    it("should accept payload as null", () => {
      const input = {
        filename: "test.json",
        payload: null,
      };

      const result = jsonVariantSchema.safeParse(input);

      expect(result.success).toBe(true);
    });

    it("should accept complex nested payload", () => {
      const input = {
        filename: "test.json",
        payload: {
          report: {
            week: "2024-W42",
            picks: [
              { ticker: "AAPL", side: "long" },
              { ticker: "MSFT", side: "short" },
            ],
          },
        },
      };

      const result = jsonVariantSchema.safeParse(input);

      expect(result.success).toBe(true);
    });
  });

  describe("invalid payloads", () => {
    it("should reject missing filename", () => {
      const input = {
        payload: { data: "test" },
      };

      const result = jsonVariantSchema.safeParse(input);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((i) => i.path.includes("filename"))).toBe(true);
      }
    });

    it("should accept missing payload (z.unknown() accepts undefined)", () => {
      const input = {
        filename: "test.json",
      };

      const result = jsonVariantSchema.safeParse(input);

      // Schema allows payload to be undefined (z.unknown() accepts any value)
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.filename).toBe("test.json");
      }
    });

    it("should accept empty filename (no min length constraint)", () => {
      const input = {
        filename: "",
        payload: { data: "test" },
      };

      const result = jsonVariantSchema.safeParse(input);

      // Schema accepts empty string (no .min(1) constraint on filename)
      expect(result.success).toBe(true);
    });

    it("should reject non-string filename", () => {
      const input = {
        filename: 12345,
        payload: { data: "test" },
      };

      const result = jsonVariantSchema.safeParse(input);

      expect(result.success).toBe(false);
    });

    it("should reject when filename is missing", () => {
      const input = {};

      const result = jsonVariantSchema.safeParse(input);

      expect(result.success).toBe(false);
      if (!result.success) {
        // Only filename is required, payload can be undefined
        expect(result.error.issues.some((i) => i.path.includes("filename"))).toBe(true);
      }
    });
  });
});

describe("isPayloadSizeValid", () => {
  it("should return true for size exactly at limit", () => {
    const result = isPayloadSizeValid(MAX_PAYLOAD_SIZE);

    expect(result).toBe(true);
  });

  it("should return true for size below limit", () => {
    const result = isPayloadSizeValid(MAX_PAYLOAD_SIZE - 1);

    expect(result).toBe(true);
  });

  it("should return false for size above limit", () => {
    const result = isPayloadSizeValid(MAX_PAYLOAD_SIZE + 1);

    expect(result).toBe(false);
  });

  it("should return true for zero size", () => {
    const result = isPayloadSizeValid(0);

    expect(result).toBe(true);
  });

  it("should return true for small payload (1 KB)", () => {
    const result = isPayloadSizeValid(1024);

    expect(result).toBe(true);
  });

  it("should return true for medium payload (1 MB)", () => {
    const result = isPayloadSizeValid(1024 * 1024);

    expect(result).toBe(true);
  });

  it("should return false for very large payload (10 MB)", () => {
    const result = isPayloadSizeValid(10 * 1024 * 1024);

    expect(result).toBe(false);
  });

  it("should handle negative values (return true since they're technically <= limit)", () => {
    const result = isPayloadSizeValid(-100);

    expect(result).toBe(true);
  });
});

describe("calculatePayloadSize", () => {
  it("should calculate size of empty object", () => {
    const size = calculatePayloadSize({});

    expect(size).toBe(2); // "{}"
  });

  it("should calculate size of empty array", () => {
    const size = calculatePayloadSize([]);

    expect(size).toBe(2); // "[]"
  });

  it("should calculate size of simple string", () => {
    const size = calculatePayloadSize("hello");

    expect(size).toBe(7); // '"hello"'
  });

  it("should calculate size of number", () => {
    const size = calculatePayloadSize(42);

    expect(size).toBe(2); // "42"
  });

  it("should calculate size of boolean true", () => {
    const size = calculatePayloadSize(true);

    expect(size).toBe(4); // "true"
  });

  it("should calculate size of boolean false", () => {
    const size = calculatePayloadSize(false);

    expect(size).toBe(5); // "false"
  });

  it("should calculate size of null", () => {
    const size = calculatePayloadSize(null);

    expect(size).toBe(4); // "null"
  });

  it("should calculate size of simple object", () => {
    const payload = { key: "value" };
    const size = calculatePayloadSize(payload);

    expect(size).toBe(JSON.stringify(payload).length);
  });

  it("should calculate size of nested object", () => {
    const payload = {
      report: {
        week: "2024-W42",
        picks: [{ ticker: "AAPL" }],
      },
    };
    const size = calculatePayloadSize(payload);
    const expectedSize = JSON.stringify(payload).length;

    expect(size).toBe(expectedSize);
  });

  it("should calculate size of large array", () => {
    const payload = new Array(1000).fill({ data: "test" });
    const size = calculatePayloadSize(payload);

    expect(size).toBeGreaterThan(10000);
  });

  it("should calculate size considering UTF-8 encoding", () => {
    const payload = { emoji: "😀" };
    const size = calculatePayloadSize(payload);

    // Emoji takes more bytes in UTF-8
    expect(size).toBeGreaterThan(JSON.stringify({ emoji: "a" }).length);
  });

  it("should calculate size of payload with special characters", () => {
    const payload = { text: "Hello\nWorld\t!" };
    const size = calculatePayloadSize(payload);
    const expectedSize = Buffer.byteLength(JSON.stringify(payload), "utf8");

    expect(size).toBe(expectedSize);
  });

  it("should be deterministic for same payload", () => {
    const payload = { key: "value", num: 42 };
    const size1 = calculatePayloadSize(payload);
    const size2 = calculatePayloadSize(payload);

    expect(size1).toBe(size2);
  });
});

describe("MAX_PAYLOAD_SIZE constant", () => {
  it("should be defined as 5 MB", () => {
    expect(MAX_PAYLOAD_SIZE).toBe(5 * 1024 * 1024);
  });

  it("should equal 5242880 bytes", () => {
    expect(MAX_PAYLOAD_SIZE).toBe(5242880);
  });
});

describe("integration - filename validation with jsonVariantSchema", () => {
  it("should accept JSON variant with valid filename format", () => {
    const input = {
      filename: "2024-11-02report.json",
      payload: { data: "test" },
    };

    const result = jsonVariantSchema.safeParse(input);

    expect(result.success).toBe(true);
  });

  it("should accept JSON variant with invalid filename format (schema doesn't validate filename format)", () => {
    // Note: jsonVariantSchema only checks that filename is a string,
    // it doesn't validate the format. Format validation happens separately.
    const input = {
      filename: "invalid-format.json",
      payload: { data: "test" },
    };

    const result = jsonVariantSchema.safeParse(input);

    expect(result.success).toBe(true);
  });
});

describe("integration - payload size validation", () => {
  it("should correctly identify payload within size limit", () => {
    const payload = { data: "small payload" };
    const size = calculatePayloadSize(payload);
    const isValid = isPayloadSizeValid(size);

    expect(isValid).toBe(true);
    expect(size).toBeLessThan(MAX_PAYLOAD_SIZE);
  });

  it("should correctly identify oversized payload", () => {
    // Create a payload larger than 5 MB
    const largeString = "x".repeat(6 * 1024 * 1024);
    const payload = { data: largeString };
    const size = calculatePayloadSize(payload);
    const isValid = isPayloadSizeValid(size);

    expect(isValid).toBe(false);
    expect(size).toBeGreaterThan(MAX_PAYLOAD_SIZE);
  });

  it("should correctly identify payload at exact size limit", () => {
    // Create a payload at exactly 5 MB (accounting for JSON overhead)
    const targetSize = MAX_PAYLOAD_SIZE - 20; // Account for {"data":"..."} overhead
    const largeString = "x".repeat(targetSize);
    const payload = { data: largeString };
    const size = calculatePayloadSize(payload);
    const isValid = isPayloadSizeValid(size);

    expect(size).toBeLessThanOrEqual(MAX_PAYLOAD_SIZE);
    expect(isValid).toBe(true);
  });
});
