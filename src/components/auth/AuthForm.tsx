import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { registerCommandSchema, loginCommandSchema } from "@/lib/validation/auth";
import type { RegisterCommand, LoginCommand } from "@/types";
import { z } from "zod";

interface AuthFormProps {
  mode: "register" | "login";
  returnUrl?: string;
}

interface ValidationErrors {
  email?: string;
  password?: string;
  confirmPassword?: string;
  form?: string;
}

/**
 * AuthForm - A reusable authentication form component
 *
 * Supports two modes: "register" and "login"
 * - Register mode: email, password, confirm password with client-side validation
 * - Login mode: email, password only
 *
 * Features:
 * - Client-side validation with Zod
 * - Accessible form with ARIA attributes
 * - Loading states during submission
 * - Inline error messages
 * - Success/error feedback
 */
export default function AuthForm({ mode, returnUrl }: AuthFormProps) {
  // Form state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const isRegisterMode = mode === "register";
  const formTitle = isRegisterMode ? "Create an Account" : "Sign In";
  const submitButtonText = isRegisterMode ? "Create Account" : "Sign In";

  /**
   * Client-side validation using Zod schemas
   */
  const validateForm = (): boolean => {
    const newErrors: ValidationErrors = {};

    // Validate based on mode
    if (isRegisterMode) {
      // For registration, validate with schema and confirm password
      const result = registerCommandSchema.safeParse({ email, password });
      if (!result.success) {
        result.error.issues.forEach((issue) => {
          const field = issue.path[0] as keyof ValidationErrors;
          if (field === "email" || field === "password") {
            newErrors[field] = issue.message;
          }
        });
      }

      // Check confirm password
      if (!confirmPassword) {
        newErrors.confirmPassword = "Please confirm your password";
      } else if (password !== confirmPassword) {
        newErrors.confirmPassword = "Passwords do not match";
      }
    } else {
      // For login, just validate basic structure
      const result = loginCommandSchema.safeParse({ email, password });
      if (!result.success) {
        result.error.issues.forEach((issue) => {
          const field = issue.path[0] as keyof ValidationErrors;
          if (field === "email" || field === "password") {
            newErrors[field] = issue.message;
          }
        });
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  /**
   * Handle form submission
   */
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    // Reset messages
    setSuccessMessage(null);
    setErrors({});

    // Validate form
    if (!validateForm()) {
      // Focus first field with error
      const firstErrorField = document.querySelector("[aria-invalid='true']") as HTMLElement;
      firstErrorField?.focus();
      return;
    }

    setIsSubmitting(true);

    try {
      const endpoint = isRegisterMode ? "/api/auth/register" : "/api/auth/login";
      const body: RegisterCommand | LoginCommand = { email, password };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        // Handle error responses
        if (response.status === 401) {
          // Unauthorized - invalid credentials (login only)
          setErrors({ form: "Invalid email or password." });
        } else if (response.status === 409) {
          // Conflict - email already exists (register only)
          setErrors({ form: "An account with this email already exists. Please log in instead." });
        } else if (response.status === 429) {
          // Rate limited
          setErrors({ form: "Too many attempts. Please try again later." });
        } else if (response.status === 400) {
          // Bad request - validation error
          setErrors({ form: data.message || "Invalid input. Please check your entries." });
        } else {
          // Generic error
          setErrors({ form: data.message || "Something went wrong. Please try again." });
        }
        return;
      }

      // Success!
      if (isRegisterMode) {
        setSuccessMessage(
          "Account created successfully! Please check your email to verify your account before logging in."
        );
        // Clear form
        setEmail("");
        setPassword("");
        setConfirmPassword("");

        // Redirect to login page after a short delay
        setTimeout(() => {
          window.location.href = "/auth/login";
        }, 2000);
      } else {
        // Login successful - redirect to home page (reports list) or returnUrl
        window.location.href = returnUrl || "/";
      }
    } catch (err) {
      console.error(`[AuthForm] ${mode} error:`, err);
      setErrors({
        form: "Network error. Please check your connection and try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Handle field blur to show validation errors early
   */
  const handleFieldBlur = (field: "email" | "password" | "confirmPassword") => {
    const newErrors: ValidationErrors = { ...errors };

    if (field === "email") {
      const result = z.string().email().safeParse(email);
      if (!result.success) {
        newErrors.email = "Invalid email address";
      } else {
        delete newErrors.email;
      }
    } else if (field === "password" && isRegisterMode) {
      const result = registerCommandSchema.shape.password.safeParse(password);
      if (!result.success && password.length > 0) {
        newErrors.password = result.error.issues[0]?.message || "Invalid password";
      } else {
        delete newErrors.password;
      }
    } else if (field === "confirmPassword" && isRegisterMode) {
      if (confirmPassword && password !== confirmPassword) {
        newErrors.confirmPassword = "Passwords do not match";
      } else {
        delete newErrors.confirmPassword;
      }
    }

    setErrors(newErrors);
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6 text-center">{formTitle}</h1>

        {/* Success message */}
        {successMessage && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-md" role="status" aria-live="polite">
            <p className="text-sm text-green-800">{successMessage}</p>
          </div>
        )}

        {/* Form-level error */}
        {errors.form && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md" role="alert" aria-live="assertive">
            <p className="text-sm text-red-800">{errors.form}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          {/* Email field */}
          <div className="mb-4">
            <Label htmlFor="email">
              Email Address
              <span className="text-red-600 ml-1" aria-label="required">
                *
              </span>
            </Label>
            <Input
              id="email"
              type="email"
              name="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => handleFieldBlur("email")}
              disabled={isSubmitting}
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? "email-error" : undefined}
              required
              autoComplete="email"
              className="mt-1"
            />
            {errors.email && (
              <p id="email-error" className="mt-1 text-sm text-red-600" role="alert">
                {errors.email}
              </p>
            )}
          </div>

          {/* Password field */}
          <div className="mb-4">
            <Label htmlFor="password">
              Password
              <span className="text-red-600 ml-1" aria-label="required">
                *
              </span>
            </Label>
            <Input
              id="password"
              type="password"
              name="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onBlur={() => handleFieldBlur("password")}
              disabled={isSubmitting}
              aria-invalid={!!errors.password}
              aria-describedby={errors.password ? "password-error password-hint" : "password-hint"}
              required
              autoComplete={isRegisterMode ? "new-password" : "current-password"}
              className="mt-1"
            />
            {isRegisterMode && (
              <p id="password-hint" className="mt-1 text-xs text-gray-600">
                Must be at least 8 characters with uppercase, lowercase, and number
              </p>
            )}
            {errors.password && (
              <p id="password-error" className="mt-1 text-sm text-red-600" role="alert">
                {errors.password}
              </p>
            )}
          </div>

          {/* Confirm Password field (register only) */}
          {isRegisterMode && (
            <div className="mb-6">
              <Label htmlFor="confirmPassword">
                Confirm Password
                <span className="text-red-600 ml-1" aria-label="required">
                  *
                </span>
              </Label>
              <Input
                id="confirmPassword"
                type="password"
                name="confirmPassword"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                onBlur={() => handleFieldBlur("confirmPassword")}
                disabled={isSubmitting}
                aria-invalid={!!errors.confirmPassword}
                aria-describedby={errors.confirmPassword ? "confirmPassword-error" : undefined}
                required
                autoComplete="new-password"
                className="mt-1"
              />
              {errors.confirmPassword && (
                <p id="confirmPassword-error" className="mt-1 text-sm text-red-600" role="alert">
                  {errors.confirmPassword}
                </p>
              )}
            </div>
          )}

          {/* Submit button */}
          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? "Please wait..." : submitButtonText}
          </Button>

          {/* Additional links */}
          <div className="mt-4 text-center text-sm">
            {isRegisterMode ? (
              <p className="text-gray-600">
                Already have an account?{" "}
                <a href="/auth/login" className="text-blue-600 hover:text-blue-800 font-medium">
                  Sign in
                </a>
              </p>
            ) : (
              <p className="text-gray-600">
                Don&apos;t have an account?{" "}
                <a href="/auth/register" className="text-blue-600 hover:text-blue-800 font-medium">
                  Create one
                </a>
              </p>
            )}
          </div>
        </form>
      </div>

      {/* Password policy info for registration */}
      {isRegisterMode && (
        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
          <h2 className="text-sm font-semibold text-blue-900 mb-2">Password Requirements</h2>
          <ul className="text-xs text-blue-800 space-y-1 list-disc list-inside">
            <li>At least 8 characters long</li>
            <li>Contains at least one uppercase letter (A-Z)</li>
            <li>Contains at least one lowercase letter (a-z)</li>
            <li>Contains at least one number (0-9)</li>
          </ul>
        </div>
      )}
    </div>
  );
}
