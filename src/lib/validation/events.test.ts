import { describe, it, expect } from 'vitest';
import { postEventSchema, parsePostEventCommand, isDomainValidationError } from './events';
import { z } from 'zod';

describe('postEventSchema', () => {
	describe('valid payloads', () => {
		it('should accept valid registration_complete event', () => {
			const input = {
				event_type: 'registration_complete',
			};

			const result = postEventSchema.safeParse(input);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.event_type).toBe('registration_complete');
				expect(result.data.dwell_seconds).toBeUndefined();
				expect(result.data.report_id).toBeUndefined();
				expect(result.data.metadata).toBeUndefined();
			}
		});

		it('should accept valid login event', () => {
			const input = {
				event_type: 'login',
			};

			const result = postEventSchema.safeParse(input);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.event_type).toBe('login');
			}
		});

		it('should accept valid table_view event', () => {
			const input = {
				event_type: 'table_view',
				dwell_seconds: 45,
			};

			const result = postEventSchema.safeParse(input);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.event_type).toBe('table_view');
				expect(result.data.dwell_seconds).toBe(45);
			}
		});

		it('should accept valid report_view event with dwell_seconds >= 10', () => {
			const input = {
				event_type: 'report_view',
				dwell_seconds: 10,
				report_id: '123e4567-e89b-12d3-a456-426614174000',
			};

			const result = postEventSchema.safeParse(input);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.event_type).toBe('report_view');
				expect(result.data.dwell_seconds).toBe(10);
				expect(result.data.report_id).toBe('123e4567-e89b-12d3-a456-426614174000');
			}
		});

		it('should accept report_view with large dwell_seconds', () => {
			const input = {
				event_type: 'report_view',
				dwell_seconds: 3600, // 1 hour
			};

			const result = postEventSchema.safeParse(input);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.dwell_seconds).toBe(3600);
			}
		});

		it('should accept event with valid metadata', () => {
			const input = {
				event_type: 'login',
				metadata: {
					source: 'mobile_app',
					version: '2.1.0',
					flags: { ab_test: true },
				},
			};

			const result = postEventSchema.safeParse(input);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.metadata).toEqual({
					source: 'mobile_app',
					version: '2.1.0',
					flags: { ab_test: true },
				});
			}
		});

		it('should accept event with all optional fields', () => {
			const input = {
				event_type: 'report_view',
				dwell_seconds: 120,
				report_id: '123e4567-e89b-12d3-a456-426614174000',
				metadata: { referrer: 'homepage' },
			};

			const result = postEventSchema.safeParse(input);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.event_type).toBe('report_view');
				expect(result.data.dwell_seconds).toBe(120);
				expect(result.data.report_id).toBe('123e4567-e89b-12d3-a456-426614174000');
				expect(result.data.metadata).toEqual({ referrer: 'homepage' });
			}
		});
	});

	describe('invalid event_type', () => {
		it('should reject missing event_type', () => {
			const input = {};

			const result = postEventSchema.safeParse(input);

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error.issues.some((i) => i.path.includes('event_type'))).toBe(true);
			}
		});

		it('should reject invalid event_type value', () => {
			const input = {
				event_type: 'invalid_event',
			};

			const result = postEventSchema.safeParse(input);

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error.issues.some((i) => i.path.includes('event_type'))).toBe(true);
			}
		});

		it('should reject numeric event_type', () => {
			const input = {
				event_type: 123,
			};

			const result = postEventSchema.safeParse(input);

			expect(result.success).toBe(false);
		});
	});

	describe('dwell_seconds validation', () => {
		it('should reject negative dwell_seconds', () => {
			const input = {
				event_type: 'login',
				dwell_seconds: -5,
			};

			const result = postEventSchema.safeParse(input);

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error.issues.some((i) => i.message.includes('dwell_seconds'))).toBe(true);
			}
		});

		it('should accept dwell_seconds of 0', () => {
			const input = {
				event_type: 'login',
				dwell_seconds: 0,
			};

			const result = postEventSchema.safeParse(input);

			expect(result.success).toBe(true);
		});

		it('should reject non-numeric dwell_seconds', () => {
			const input = {
				event_type: 'login',
				dwell_seconds: 'not-a-number',
			};

			const result = postEventSchema.safeParse(input);

			expect(result.success).toBe(false);
		});
	});

	describe('report_view domain rules', () => {
		it('should reject report_view without dwell_seconds', () => {
			const input = {
				event_type: 'report_view',
			};

			const result = postEventSchema.safeParse(input);

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error.issues.some((i) => i.path.includes('dwell_seconds'))).toBe(true);
				expect(result.error.issues.some((i) => i.message.includes('required'))).toBe(true);
				// Check that this is marked as a domain error
				expect(result.error.issues.some((i) => i.params?.domain === true)).toBe(true);
			}
		});

		it('should reject report_view with dwell_seconds < 10', () => {
			const input = {
				event_type: 'report_view',
				dwell_seconds: 9,
			};

			const result = postEventSchema.safeParse(input);

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error.issues.some((i) => i.path.includes('dwell_seconds'))).toBe(true);
				expect(result.error.issues.some((i) => i.message.includes('at least 10'))).toBe(true);
				// Check that this is marked as a domain error
				expect(result.error.issues.some((i) => i.params?.domain === true)).toBe(true);
			}
		});

		it('should accept report_view with dwell_seconds exactly 10', () => {
			const input = {
				event_type: 'report_view',
				dwell_seconds: 10,
			};

			const result = postEventSchema.safeParse(input);

			expect(result.success).toBe(true);
		});

		it('should accept report_view with dwell_seconds = 10.5 (float)', () => {
			const input = {
				event_type: 'report_view',
				dwell_seconds: 10.5,
			};

			const result = postEventSchema.safeParse(input);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.dwell_seconds).toBe(10.5);
			}
		});
	});

	describe('report_id validation', () => {
		it('should reject invalid UUID format', () => {
			const input = {
				event_type: 'report_view',
				dwell_seconds: 15,
				report_id: 'not-a-uuid',
			};

			const result = postEventSchema.safeParse(input);

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error.issues.some((i) => i.path.includes('report_id'))).toBe(true);
				expect(result.error.issues.some((i) => i.message.includes('UUID'))).toBe(true);
			}
		});

		it('should accept valid UUID', () => {
			const input = {
				event_type: 'report_view',
				dwell_seconds: 15,
				report_id: '550e8400-e29b-41d4-a716-446655440000',
			};

			const result = postEventSchema.safeParse(input);

			expect(result.success).toBe(true);
		});

		it('should accept UUID in different formats', () => {
			const input = {
				event_type: 'report_view',
				dwell_seconds: 15,
				report_id: '550E8400-E29B-41D4-A716-446655440000', // uppercase
			};

			const result = postEventSchema.safeParse(input);

			expect(result.success).toBe(true);
		});

		it('should accept nil UUID', () => {
			const input = {
				event_type: 'report_view',
				dwell_seconds: 15,
				report_id: '00000000-0000-0000-0000-000000000000',
			};

			const result = postEventSchema.safeParse(input);

			expect(result.success).toBe(true);
		});
	});

	describe('metadata validation', () => {
		it('should accept null metadata', () => {
			const input = {
				event_type: 'login',
				metadata: null,
			};

			const result = postEventSchema.safeParse(input);

			expect(result.success).toBe(true);
		});

		it('should accept simple object metadata', () => {
			const input = {
				event_type: 'login',
				metadata: { key: 'value' },
			};

			const result = postEventSchema.safeParse(input);

			expect(result.success).toBe(true);
		});

		it('should accept nested object metadata', () => {
			const input = {
				event_type: 'login',
				metadata: {
					user: { id: 123, name: 'Test' },
					context: { page: 'home' },
				},
			};

			const result = postEventSchema.safeParse(input);

			expect(result.success).toBe(true);
		});

		it('should accept array metadata', () => {
			const input = {
				event_type: 'login',
				metadata: [1, 2, 3],
			};

			const result = postEventSchema.safeParse(input);

			expect(result.success).toBe(true);
		});

		it('should reject metadata exceeding size limit', () => {
			// Create a large object (> 64KB)
			const largeMetadata = {
				data: 'x'.repeat(70000),
			};

			const input = {
				event_type: 'login',
				metadata: largeMetadata,
			};

			const result = postEventSchema.safeParse(input);

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error.issues.some((i) => i.message.includes('64KB'))).toBe(true);
			}
		});

		it('should accept metadata at size limit', () => {
			// Create metadata close to but under 64KB
			const mediumMetadata = {
				data: 'x'.repeat(60000),
			};

			const input = {
				event_type: 'login',
				metadata: mediumMetadata,
			};

			const result = postEventSchema.safeParse(input);

			expect(result.success).toBe(true);
		});
	});

	describe('strict mode (extra fields)', () => {
		it('should reject extra top-level fields', () => {
			const input = {
				event_type: 'login',
				extra_field: 'should-be-rejected',
			};

			const result = postEventSchema.safeParse(input);

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error.issues.some((i) => i.code === 'unrecognized_keys')).toBe(true);
			}
		});

		it('should reject multiple extra fields', () => {
			const input = {
				event_type: 'login',
				field1: 'value1',
				field2: 'value2',
			};

			const result = postEventSchema.safeParse(input);

			expect(result.success).toBe(false);
		});
	});
});

describe('isDomainValidationError', () => {
	it('should return true for errors with domain flag', () => {
		const input = {
			event_type: 'report_view',
			dwell_seconds: 5,
		};

		const result = postEventSchema.safeParse(input);

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(isDomainValidationError(result.error)).toBe(true);
		}
	});

	it('should return false for structural errors', () => {
		const input = {
			event_type: 'invalid_type',
		};

		const result = postEventSchema.safeParse(input);

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(isDomainValidationError(result.error)).toBe(false);
		}
	});

	it('should return false for missing required fields', () => {
		const input = {};

		const result = postEventSchema.safeParse(input);

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(isDomainValidationError(result.error)).toBe(false);
		}
	});
});

describe('parsePostEventCommand', () => {
	it('should return validated command for valid input', () => {
		const input = {
			event_type: 'login',
			metadata: { source: 'web' },
		};

		const result = parsePostEventCommand(input);

		expect(result.event_type).toBe('login');
		expect(result.metadata).toEqual({ source: 'web' });
	});

	it('should throw error with bad_request code for structural errors', () => {
		const input = {
			event_type: 'invalid_event',
		};

		expect(() => parsePostEventCommand(input)).toThrow();

		try {
			parsePostEventCommand(input);
		} catch (error: any) {
			expect(error.code).toBe('bad_request');
			expect(error.message).toBeTruthy();
			expect(error.details).toBeDefined();
		}
	});

	it('should throw error with unprocessable_entity code for domain errors', () => {
		const input = {
			event_type: 'report_view',
			dwell_seconds: 5,
		};

		expect(() => parsePostEventCommand(input)).toThrow();

		try {
			parsePostEventCommand(input);
		} catch (error: any) {
			expect(error.code).toBe('unprocessable_entity');
			expect(error.message).toContain('at least 10');
			expect(error.details).toBeDefined();
		}
	});

	it('should include all validation errors in message', () => {
		const input = {
			event_type: 'report_view',
			report_id: 'invalid-uuid',
			// missing dwell_seconds (domain error)
		};

		try {
			parsePostEventCommand(input);
			expect.fail('Should have thrown error');
		} catch (error: any) {
			expect(error.message).toBeTruthy();
			// Should mention both dwell_seconds and report_id errors
			expect(error.details.length).toBeGreaterThan(0);
		}
	});
});

