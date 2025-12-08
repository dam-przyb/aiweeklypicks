import { z } from "zod";
import type { RegisterCommand, LoginCommand } from "@/types";

/**
 * Password validation requirements:
 * - Minimum 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 */
const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[0-9]/, "Password must contain at least one number");

/**
 * Email validation schema
 */
const emailSchema = z.string().email("Invalid email address");

/**
 * Zod schema for validating POST /api/auth/register request body
 *
 * Validates:
 * - email: Must be a valid email address
 * - password: Must meet password policy requirements
 */
export const registerCommandSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
  })
  .strict(); // Reject extra fields

/**
 * Zod schema for validating POST /api/auth/login request body
 *
 * Validates:
 * - email: Must be a valid email address
 * - password: Must be a string (we don't validate policy on login)
 */
export const loginCommandSchema = z
  .object({
    email: emailSchema,
    password: z.string().min(1, "Password is required"),
  })
  .strict(); // Reject extra fields

/**
 * Parses and validates the request body for POST /api/auth/register
 *
 * @param body - The parsed JSON body from the request
 * @returns Validated RegisterCommand object
 * @throws Error with code 'bad_request' if validation fails
 */
export function parseRegisterCommand(body: unknown): RegisterCommand {
  const parsed = registerCommandSchema.safeParse(body);

  if (!parsed.success) {
    // Collect all validation error messages
    const message = parsed.error.issues.map((i) => i.message).join("; ");

    // Create error with custom code for error handling in route
    const error: any = new Error(message);
    error.code = "bad_request";
    error.details = parsed.error.issues;
    throw error;
  }

  return parsed.data;
}

/**
 * Parses and validates the request body for POST /api/auth/login
 *
 * @param body - The parsed JSON body from the request
 * @returns Validated LoginCommand object
 * @throws Error with code 'bad_request' if validation fails
 */
export function parseLoginCommand(body: unknown): LoginCommand {
  const parsed = loginCommandSchema.safeParse(body);

  if (!parsed.success) {
    // Collect all validation error messages
    const message = parsed.error.issues.map((i) => i.message).join("; ");

    // Create error with custom code for error handling in route
    const error: any = new Error(message);
    error.code = "bad_request";
    error.details = parsed.error.issues;
    throw error;
  }

  return parsed.data;
}
