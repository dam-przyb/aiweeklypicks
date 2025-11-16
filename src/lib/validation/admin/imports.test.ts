import { describe, it, expect } from 'vitest';
import { adminImportsQuerySchema, parseAdminImportsQuery, ValidationError } from './imports';

describe('adminImportsQuerySchema', () => {
  describe('pagination parameters', () => {
    it('should apply default values for page and page_size', () => {
      const input = {};

      const result = adminImportsQuerySchema.safeParse(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(1);
        expect(result.data.page_size).toBe(20);
      }
    });

    it('should accept valid page and page_size', () => {
      const input = {
        page: '2',
        page_size: '50',
      };

      const result = adminImportsQuerySchema.safeParse(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(2);
        expect(result.data.page_size).toBe(50);
      }
    });

    it('should coerce string numbers to integers', () => {
      const input = {
        page: '5',
        page_size: '25',
      };

      const result = adminImportsQuerySchema.safeParse(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(5);
        expect(result.data.page_size).toBe(25);
      }
    });

    it('should reject page < 1', () => {
      const input = {
        page: '0',
      };

      const result = adminImportsQuerySchema.safeParse(input);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((i) => i.path.includes('page'))).toBe(true);
      }
    });

    it('should reject page_size < 1', () => {
      const input = {
        page_size: '0',
      };

      const result = adminImportsQuerySchema.safeParse(input);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((i) => i.path.includes('page_size'))).toBe(true);
      }
    });

    it('should reject page_size > 100', () => {
      const input = {
        page_size: '101',
      };

      const result = adminImportsQuerySchema.safeParse(input);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((i) => i.path.includes('page_size'))).toBe(true);
      }
    });

    it('should accept page_size exactly at 100', () => {
      const input = {
        page_size: '100',
      };

      const result = adminImportsQuerySchema.safeParse(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page_size).toBe(100);
      }
    });

    it('should reject non-numeric page', () => {
      const input = {
        page: 'not-a-number',
      };

      const result = adminImportsQuerySchema.safeParse(input);

      expect(result.success).toBe(false);
    });

    it('should reject non-numeric page_size', () => {
      const input = {
        page_size: 'invalid',
      };

      const result = adminImportsQuerySchema.safeParse(input);

      expect(result.success).toBe(false);
    });

    it('should reject negative page', () => {
      const input = {
        page: '-1',
      };

      const result = adminImportsQuerySchema.safeParse(input);

      expect(result.success).toBe(false);
    });

    it('should reject decimal page numbers', () => {
      const input = {
        page: '1.5',
      };

      const result = adminImportsQuerySchema.safeParse(input);

      expect(result.success).toBe(false);
    });
  });

  describe('status filter', () => {
    it('should accept status=success', () => {
      const input = {
        status: 'success',
      };

      const result = adminImportsQuerySchema.safeParse(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe('success');
      }
    });

    it('should accept status=failed', () => {
      const input = {
        status: 'failed',
      };

      const result = adminImportsQuerySchema.safeParse(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe('failed');
      }
    });

    it('should reject invalid status values', () => {
      const input = {
        status: 'pending',
      };

      const result = adminImportsQuerySchema.safeParse(input);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((i) => i.path.includes('status'))).toBe(true);
      }
    });

    it('should allow status to be omitted', () => {
      const input = {};

      const result = adminImportsQuerySchema.safeParse(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBeUndefined();
      }
    });
  });

  describe('datetime filters', () => {
    it('should accept valid started_before ISO datetime with offset', () => {
      const input = {
        started_before: '2025-11-16T10:00:00Z',
      };

      const result = adminImportsQuerySchema.safeParse(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.started_before).toBe('2025-11-16T10:00:00Z');
      }
    });

    it('should accept valid started_after ISO datetime with offset', () => {
      const input = {
        started_after: '2025-01-01T00:00:00+00:00',
      };

      const result = adminImportsQuerySchema.safeParse(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.started_after).toBe('2025-01-01T00:00:00+00:00');
      }
    });

    it('should accept ISO datetime with explicit timezone', () => {
      const input = {
        started_before: '2025-11-16T10:00:00+05:30',
      };

      const result = adminImportsQuerySchema.safeParse(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.started_before).toBe('2025-11-16T10:00:00+05:30');
      }
    });

    it('should reject invalid datetime format', () => {
      const input = {
        started_before: '2025-11-16',
      };

      const result = adminImportsQuerySchema.safeParse(input);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((i) => i.path.includes('started_before'))).toBe(true);
      }
    });

    it('should reject malformed datetime', () => {
      const input = {
        started_after: 'not-a-date',
      };

      const result = adminImportsQuerySchema.safeParse(input);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((i) => i.path.includes('started_after'))).toBe(true);
      }
    });

    it('should allow both datetime filters to be omitted', () => {
      const input = {};

      const result = adminImportsQuerySchema.safeParse(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.started_before).toBeUndefined();
        expect(result.data.started_after).toBeUndefined();
      }
    });

    it('should accept both started_before and started_after when after <= before', () => {
      const input = {
        started_after: '2025-01-01T00:00:00Z',
        started_before: '2025-12-31T23:59:59Z',
      };

      const result = adminImportsQuerySchema.safeParse(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.started_after).toBe('2025-01-01T00:00:00Z');
        expect(result.data.started_before).toBe('2025-12-31T23:59:59Z');
      }
    });

    it('should reject when started_after > started_before', () => {
      const input = {
        started_after: '2025-12-31T23:59:59Z',
        started_before: '2025-01-01T00:00:00Z',
      };

      const result = adminImportsQuerySchema.safeParse(input);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((i) => i.message.includes('started_after'))).toBe(true);
        expect(result.error.issues.some((i) => i.message.includes('started_before'))).toBe(true);
      }
    });

    it('should accept when started_after equals started_before', () => {
      const input = {
        started_after: '2025-06-15T12:00:00Z',
        started_before: '2025-06-15T12:00:00Z',
      };

      const result = adminImportsQuerySchema.safeParse(input);

      expect(result.success).toBe(true);
    });
  });

  describe('uploader filter', () => {
    it('should accept valid UUID', () => {
      const input = {
        uploader: '550e8400-e29b-41d4-a716-446655440000',
      };

      const result = adminImportsQuerySchema.safeParse(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.uploader).toBe('550e8400-e29b-41d4-a716-446655440000');
      }
    });

    it('should accept UUID in uppercase', () => {
      const input = {
        uploader: '550E8400-E29B-41D4-A716-446655440000',
      };

      const result = adminImportsQuerySchema.safeParse(input);

      expect(result.success).toBe(true);
    });

    it('should accept nil UUID', () => {
      const input = {
        uploader: '00000000-0000-0000-0000-000000000000',
      };

      const result = adminImportsQuerySchema.safeParse(input);

      expect(result.success).toBe(true);
    });

    it('should reject invalid UUID format', () => {
      const input = {
        uploader: 'not-a-uuid',
      };

      const result = adminImportsQuerySchema.safeParse(input);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((i) => i.path.includes('uploader'))).toBe(true);
      }
    });

    it('should reject UUID without hyphens', () => {
      const input = {
        uploader: '550e8400e29b41d4a716446655440000',
      };

      const result = adminImportsQuerySchema.safeParse(input);

      expect(result.success).toBe(false);
    });

    it('should allow uploader to be omitted', () => {
      const input = {};

      const result = adminImportsQuerySchema.safeParse(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.uploader).toBeUndefined();
      }
    });
  });

  describe('combined filters', () => {
    it('should accept all filters together', () => {
      const input = {
        page: '3',
        page_size: '50',
        status: 'failed',
        started_after: '2025-01-01T00:00:00Z',
        started_before: '2025-12-31T23:59:59Z',
        uploader: '550e8400-e29b-41d4-a716-446655440000',
      };

      const result = adminImportsQuerySchema.safeParse(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(3);
        expect(result.data.page_size).toBe(50);
        expect(result.data.status).toBe('failed');
        expect(result.data.started_after).toBe('2025-01-01T00:00:00Z');
        expect(result.data.started_before).toBe('2025-12-31T23:59:59Z');
        expect(result.data.uploader).toBe('550e8400-e29b-41d4-a716-446655440000');
      }
    });

    it('should accept partial filters', () => {
      const input = {
        status: 'success',
        started_before: '2025-11-16T10:00:00Z',
      };

      const result = adminImportsQuerySchema.safeParse(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(1); // default
        expect(result.data.page_size).toBe(20); // default
        expect(result.data.status).toBe('success');
        expect(result.data.started_before).toBe('2025-11-16T10:00:00Z');
        expect(result.data.started_after).toBeUndefined();
        expect(result.data.uploader).toBeUndefined();
      }
    });
  });
});

describe('parseAdminImportsQuery', () => {
  it('should parse valid URL query parameters', () => {
    const url = new URL('http://example.com/api/admin/imports?page=2&page_size=30&status=success');

    const result = parseAdminImportsQuery(url);

    expect(result.page).toBe(2);
    expect(result.page_size).toBe(30);
    expect(result.status).toBe('success');
  });

  it('should apply defaults for missing parameters', () => {
    const url = new URL('http://example.com/api/admin/imports');

    const result = parseAdminImportsQuery(url);

    expect(result.page).toBe(1);
    expect(result.page_size).toBe(20);
  });

  it('should parse datetime filters', () => {
    const url = new URL(
      'http://example.com/api/admin/imports?started_after=2025-01-01T00:00:00Z&started_before=2025-12-31T23:59:59Z'
    );

    const result = parseAdminImportsQuery(url);

    expect(result.started_after).toBe('2025-01-01T00:00:00Z');
    expect(result.started_before).toBe('2025-12-31T23:59:59Z');
  });

  it('should parse uploader UUID', () => {
    const url = new URL('http://example.com/api/admin/imports?uploader=550e8400-e29b-41d4-a716-446655440000');

    const result = parseAdminImportsQuery(url);

    expect(result.uploader).toBe('550e8400-e29b-41d4-a716-446655440000');
  });

  it('should throw ValidationError for invalid parameters', () => {
    const url = new URL('http://example.com/api/admin/imports?page=0');

    expect(() => parseAdminImportsQuery(url)).toThrow(ValidationError);
  });

  it('should throw ValidationError with descriptive message', () => {
    const url = new URL('http://example.com/api/admin/imports?page_size=101');

    try {
      parseAdminImportsQuery(url);
      expect.fail('Should have thrown ValidationError');
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
      if (error instanceof ValidationError) {
        expect(error.code).toBe('bad_request');
        // Zod's error message for max constraint
        expect(error.message).toContain('100');
      }
    }
  });

  it('should throw ValidationError when started_after > started_before', () => {
    const url = new URL(
      'http://example.com/api/admin/imports?started_after=2025-12-31T23:59:59Z&started_before=2025-01-01T00:00:00Z'
    );

    expect(() => parseAdminImportsQuery(url)).toThrow(ValidationError);
  });

  it('should throw ValidationError for invalid UUID', () => {
    const url = new URL('http://example.com/api/admin/imports?uploader=not-a-uuid');

    expect(() => parseAdminImportsQuery(url)).toThrow(ValidationError);
  });

  it('should throw ValidationError for invalid status', () => {
    const url = new URL('http://example.com/api/admin/imports?status=pending');

    expect(() => parseAdminImportsQuery(url)).toThrow(ValidationError);
  });

  it('should parse all parameters together', () => {
    const url = new URL(
      'http://example.com/api/admin/imports?page=5&page_size=50&status=failed&started_after=2025-01-01T00:00:00Z&uploader=550e8400-e29b-41d4-a716-446655440000'
    );

    const result = parseAdminImportsQuery(url);

    expect(result.page).toBe(5);
    expect(result.page_size).toBe(50);
    expect(result.status).toBe('failed');
    expect(result.started_after).toBe('2025-01-01T00:00:00Z');
    expect(result.uploader).toBe('550e8400-e29b-41d4-a716-446655440000');
  });

  it('should handle URL-encoded parameters', () => {
    const url = new URL('http://example.com/api/admin/imports?started_before=2025-11-16T10%3A00%3A00Z');

    const result = parseAdminImportsQuery(url);

    expect(result.started_before).toBe('2025-11-16T10:00:00Z');
  });
});

describe('ValidationError', () => {
  it('should have correct properties', () => {
    const error = new ValidationError('Test error message');

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('ValidationError');
    expect(error.code).toBe('bad_request');
    expect(error.message).toBe('Test error message');
  });

  it('should be catchable as Error', () => {
    try {
      throw new ValidationError('Test');
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(ValidationError);
    }
  });
});

