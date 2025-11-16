import { z } from 'zod';

/**
 * Validates filename format: YYYY-MM-DDreport.json
 * Example: 2024-11-02report.json
 */
export const filenameSchema = z
  .string()
  .regex(
    /^\d{4}-\d{2}-\d{2}report\.json$/,
    'Filename must match format: YYYY-MM-DDreport.json'
  );

/**
 * Schema for JSON variant upload (application/json content-type)
 * Validates the command body structure
 */
export const jsonVariantSchema = z.object({
  filename: z.string(),
  payload: z.unknown(), // Will be validated by the RPC
});

/**
 * Maximum allowed payload size in bytes (5 MB)
 */
export const MAX_PAYLOAD_SIZE = 5 * 1024 * 1024; // 5 MB

/**
 * Validates that a payload size is within the allowed limit
 * @param sizeInBytes - Size to validate
 * @returns true if within limit, false otherwise
 */
export function isPayloadSizeValid(sizeInBytes: number): boolean {
  return sizeInBytes <= MAX_PAYLOAD_SIZE;
}

/**
 * Calculates the byte size of a JSON payload
 * @param payload - The payload to measure
 * @returns Size in bytes
 */
export function calculatePayloadSize(payload: unknown): number {
  return Buffer.byteLength(JSON.stringify(payload), 'utf8');
}

