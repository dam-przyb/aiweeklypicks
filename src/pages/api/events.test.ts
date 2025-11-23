import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./events";

// Mock dependencies
vi.mock("@/lib/validation/events", () => ({
  parsePostEventCommand: vi.fn(),
}));

vi.mock("@/lib/services/request-context", () => ({
  getClientIp: vi.fn(),
  hashIp: vi.fn(),
}));

vi.mock("@/lib/services/rateLimit", () => ({
  limitPerKey: vi.fn(),
  RateLimitError: class RateLimitError extends Error {
    code = "rate_limited" as const;
    constructor(message = "Too many requests") {
      super(message);
      this.name = "RateLimitError";
    }
  },
}));

import { parsePostEventCommand } from "@/lib/validation/events";
import { getClientIp, hashIp } from "@/lib/services/request-context";
import { limitPerKey } from "@/lib/services/rateLimit";

describe("POST /api/events", () => {
  let mockContext: any;
  let mockSupabase: any;
  let originalEnv: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock environment variable
    originalEnv = import.meta.env.EVENT_IP_HASH_SALT;
    (import.meta.env as any).EVENT_IP_HASH_SALT = "test-salt-12345";

    mockSupabase = {
      rpc: vi.fn(),
    };

    mockContext = {
      locals: { supabase: mockSupabase },
      request: new Request("http://localhost:4321/api/events", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "user-agent": "Mozilla/5.0",
          "x-forwarded-for": "192.168.1.1",
        },
        body: JSON.stringify({
          event_type: "login",
        }),
      }),
    };

    // Default mock implementations
    vi.mocked(parsePostEventCommand).mockReturnValue({
      event_type: "login",
    });
    vi.mocked(getClientIp).mockReturnValue("192.168.1.1");
    vi.mocked(hashIp).mockReturnValue("hashed-ip-123");
    vi.mocked(limitPerKey).mockReturnValue(true);
  });

  afterEach(() => {
    (import.meta.env as any).EVENT_IP_HASH_SALT = originalEnv;
  });

  describe("successful event creation", () => {
    it("should return 202 with event_id for valid login event", async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: { event_id: "123e4567-e89b-12d3-a456-426614174000" },
        error: null,
      });

      const response = await POST(mockContext);

      expect(response.status).toBe(202);

      const body = await response.json();
      expect(body).toEqual({
        event_id: "123e4567-e89b-12d3-a456-426614174000",
        accepted: true,
      });

      expect(response.headers.get("content-type")).toBe("application/json; charset=utf-8");
      expect(response.headers.get("cache-control")).toBe("no-store");
    });

    it("should call RPC with correct parameters", async () => {
      vi.mocked(parsePostEventCommand).mockReturnValue({
        event_type: "report_view",
        dwell_seconds: 120,
        report_id: "550e8400-e29b-41d4-a716-446655440000",
        metadata: { referrer: "homepage" },
      });

      mockSupabase.rpc.mockResolvedValue({
        data: { event_id: "test-event-id" },
        error: null,
      });

      await POST(mockContext);

      expect(mockSupabase.rpc).toHaveBeenCalledWith("admin_post_event", {
        p_event_type: "report_view",
        p_dwell_seconds: 120,
        p_report_id: "550e8400-e29b-41d4-a716-446655440000",
        p_metadata: { referrer: "homepage" },
        p_user_agent: "Mozilla/5.0",
        p_ip_hash: "hashed-ip-123",
      });
    });

    it("should handle null optional fields correctly", async () => {
      vi.mocked(parsePostEventCommand).mockReturnValue({
        event_type: "login",
      });

      mockSupabase.rpc.mockResolvedValue({
        data: { event_id: "test-event-id" },
        error: null,
      });

      await POST(mockContext);

      expect(mockSupabase.rpc).toHaveBeenCalledWith("admin_post_event", {
        p_event_type: "login",
        p_dwell_seconds: null,
        p_report_id: null,
        p_metadata: null,
        p_user_agent: "Mozilla/5.0",
        p_ip_hash: "hashed-ip-123",
      });
    });

    it('should use "unknown" user agent when header is missing', async () => {
      mockContext.request = new Request("http://localhost:4321/api/events", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ event_type: "login" }),
      });

      mockSupabase.rpc.mockResolvedValue({
        data: { event_id: "test-event-id" },
        error: null,
      });

      await POST(mockContext);

      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        "admin_post_event",
        expect.objectContaining({
          p_user_agent: "unknown",
        })
      );
    });
  });

  describe("content-type validation", () => {
    it("should return 400 when Content-Type is missing", async () => {
      mockContext.request = new Request("http://localhost:4321/api/events", {
        method: "POST",
        headers: {},
        body: JSON.stringify({ event_type: "login" }),
      });

      const response = await POST(mockContext);

      expect(response.status).toBe(400);

      const body = await response.json();
      expect(body).toEqual({
        error: "invalid_content_type",
        message: "Content-Type must be application/json",
      });
    });

    it("should return 400 when Content-Type is not JSON", async () => {
      mockContext.request = new Request("http://localhost:4321/api/events", {
        method: "POST",
        headers: {
          "content-type": "text/plain",
        },
        body: "plain text",
      });

      const response = await POST(mockContext);

      expect(response.status).toBe(400);

      const body = await response.json();
      expect(body.error).toBe("invalid_content_type");
    });

    it("should accept Content-Type with charset", async () => {
      mockContext.request = new Request("http://localhost:4321/api/events", {
        method: "POST",
        headers: {
          "content-type": "application/json; charset=utf-8",
        },
        body: JSON.stringify({ event_type: "login" }),
      });

      mockSupabase.rpc.mockResolvedValue({
        data: { event_id: "test-event-id" },
        error: null,
      });

      const response = await POST(mockContext);

      expect(response.status).toBe(202);
    });
  });

  describe("JSON parsing", () => {
    it("should return 400 for malformed JSON", async () => {
      mockContext.request = new Request("http://localhost:4321/api/events", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: "not valid json {",
      });

      const response = await POST(mockContext);

      expect(response.status).toBe(400);

      const body = await response.json();
      expect(body).toEqual({
        error: "invalid_json",
        message: "Request body must be valid JSON",
      });
    });

    it("should return 400 for empty body", async () => {
      mockContext.request = new Request("http://localhost:4321/api/events", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: "",
      });

      const response = await POST(mockContext);

      expect(response.status).toBe(400);
    });
  });

  describe("validation errors", () => {
    it("should return 400 for bad_request validation error", async () => {
      const validationError: any = new Error("event_type must be one of: ...");
      validationError.code = "bad_request";
      validationError.details = [{ path: ["event_type"], message: "Invalid type" }];

      vi.mocked(parsePostEventCommand).mockImplementation(() => {
        throw validationError;
      });

      const response = await POST(mockContext);

      expect(response.status).toBe(400);

      const body = await response.json();
      expect(body.error).toBe("invalid_request");
      expect(body.message).toBeTruthy();
      expect(body.details).toBeDefined();
    });

    it("should return 422 for unprocessable_entity validation error", async () => {
      const validationError: any = new Error("dwell_seconds must be at least 10");
      validationError.code = "unprocessable_entity";
      validationError.details = [{ path: ["dwell_seconds"], message: "Too small" }];

      vi.mocked(parsePostEventCommand).mockImplementation(() => {
        throw validationError;
      });

      const response = await POST(mockContext);

      expect(response.status).toBe(422);

      const body = await response.json();
      expect(body.error).toBe("invalid_event_state");
      expect(body.message).toBeTruthy();
      expect(body.details).toBeDefined();
    });
  });

  describe("IP hashing and privacy", () => {
    it("should extract and hash client IP", async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: { event_id: "test-event-id" },
        error: null,
      });

      await POST(mockContext);

      expect(getClientIp).toHaveBeenCalledWith(mockContext.request);
      expect(hashIp).toHaveBeenCalledWith("192.168.1.1", "test-salt-12345");
      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        "admin_post_event",
        expect.objectContaining({
          p_ip_hash: "hashed-ip-123",
        })
      );
    });

    it("should return 500 when EVENT_IP_HASH_SALT is not configured", async () => {
      (import.meta.env as any).EVENT_IP_HASH_SALT = undefined;

      const response = await POST(mockContext);

      expect(response.status).toBe(500);

      const body = await response.json();
      expect(body.error).toBe("internal_error");
      // The message may vary depending on error path, but must indicate a server error
      expect(body.message).toBeTruthy();
    });

    it("should handle null IP from getClientIp", async () => {
      vi.mocked(getClientIp).mockReturnValue(null);
      vi.mocked(hashIp).mockReturnValue("hashed-unknown-ip");

      mockSupabase.rpc.mockResolvedValue({
        data: { event_id: "test-event-id" },
        error: null,
      });

      const response = await POST(mockContext);

      expect(response.status).toBe(202);
      expect(hashIp).toHaveBeenCalledWith(null, "test-salt-12345");
    });
  });

  describe("rate limiting", () => {
    it("should return 429 when rate limit is exceeded", async () => {
      vi.mocked(limitPerKey).mockReturnValue(false);

      const response = await POST(mockContext);

      expect(response.status).toBe(429);

      const body = await response.json();
      expect(body).toEqual({
        error: "rate_limited",
        message: "Too many events from this client. Please slow down.",
      });

      expect(response.headers.get("retry-after")).toBe("60");
    });

    it("should call limitPerKey with correct parameters", async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: { event_id: "test-event-id" },
        error: null,
      });

      await POST(mockContext);

      expect(limitPerKey).toHaveBeenCalledWith({
        key: "events:hashed-ip-123",
        max: 100,
        windowMs: 60_000,
      });
    });

    it("should not call RPC when rate limited", async () => {
      vi.mocked(limitPerKey).mockReturnValue(false);

      await POST(mockContext);

      expect(mockSupabase.rpc).not.toHaveBeenCalled();
    });
  });

  describe("RPC error handling", () => {
    it("should return 500 when RPC returns an error", async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: {
          code: "PGRST301",
          message: "Database connection failed",
        },
      });

      const response = await POST(mockContext);

      expect(response.status).toBe(500);

      const body = await response.json();
      expect(body).toEqual({
        error: "internal_error",
        message: "Failed to store event",
      });
    });

    it("should return 500 when RPC response is missing event_id", async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: { something_else: "value" },
        error: null,
      });

      const response = await POST(mockContext);

      expect(response.status).toBe(500);

      const body = await response.json();
      expect(body.error).toBe("internal_error");
      expect(body.message).toContain("Invalid response");
    });

    it("should return 500 when RPC returns null data", async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: null,
      });

      const response = await POST(mockContext);

      expect(response.status).toBe(500);
    });
  });

  describe("unexpected errors", () => {
    it("should return 500 for unexpected runtime errors", async () => {
      vi.mocked(parsePostEventCommand).mockImplementation(() => {
        throw new Error("Unexpected error");
      });

      const response = await POST(mockContext);

      expect(response.status).toBe(500);

      const body = await response.json();
      expect(body).toEqual({
        error: "internal_error",
        message: "Something went wrong. Please try again later.",
      });
    });

    it("should return 500 when Supabase client throws", async () => {
      mockSupabase.rpc.mockRejectedValue(new Error("Network error"));

      const response = await POST(mockContext);

      expect(response.status).toBe(500);

      const body = await response.json();
      expect(body.error).toBe("internal_error");
    });
  });

  describe("different event types", () => {
    it("should handle registration_complete event", async () => {
      vi.mocked(parsePostEventCommand).mockReturnValue({
        event_type: "registration_complete",
      });

      mockSupabase.rpc.mockResolvedValue({
        data: { event_id: "test-event-id" },
        error: null,
      });

      const response = await POST(mockContext);

      expect(response.status).toBe(202);
      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        "admin_post_event",
        expect.objectContaining({
          p_event_type: "registration_complete",
        })
      );
    });

    it("should handle report_view event with all fields", async () => {
      vi.mocked(parsePostEventCommand).mockReturnValue({
        event_type: "report_view",
        dwell_seconds: 120,
        report_id: "550e8400-e29b-41d4-a716-446655440000",
        metadata: { source: "email" },
      });

      mockSupabase.rpc.mockResolvedValue({
        data: { event_id: "test-event-id" },
        error: null,
      });

      const response = await POST(mockContext);

      expect(response.status).toBe(202);
      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        "admin_post_event",
        expect.objectContaining({
          p_event_type: "report_view",
          p_dwell_seconds: 120,
          p_report_id: "550e8400-e29b-41d4-a716-446655440000",
          p_metadata: { source: "email" },
        })
      );
    });

    it("should handle table_view event", async () => {
      vi.mocked(parsePostEventCommand).mockReturnValue({
        event_type: "table_view",
        dwell_seconds: 45,
      });

      mockSupabase.rpc.mockResolvedValue({
        data: { event_id: "test-event-id" },
        error: null,
      });

      const response = await POST(mockContext);

      expect(response.status).toBe(202);
      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        "admin_post_event",
        expect.objectContaining({
          p_event_type: "table_view",
          p_dwell_seconds: 45,
        })
      );
    });
  });
});
