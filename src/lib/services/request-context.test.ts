import { describe, it, expect } from "vitest";
import { getClientIp, hashIp } from "./request-context";

describe("getClientIp", () => {
  it("should extract IP from x-forwarded-for header", () => {
    const request = new Request("http://localhost", {
      headers: {
        "x-forwarded-for": "192.168.1.1",
      },
    });

    const ip = getClientIp(request);

    expect(ip).toBe("192.168.1.1");
  });

  it("should extract first IP from comma-separated x-forwarded-for", () => {
    const request = new Request("http://localhost", {
      headers: {
        "x-forwarded-for": "192.168.1.1, 10.0.0.1, 172.16.0.1",
      },
    });

    const ip = getClientIp(request);

    expect(ip).toBe("192.168.1.1");
  });

  it("should trim whitespace from x-forwarded-for IP", () => {
    const request = new Request("http://localhost", {
      headers: {
        "x-forwarded-for": "  192.168.1.1  , 10.0.0.1",
      },
    });

    const ip = getClientIp(request);

    expect(ip).toBe("192.168.1.1");
  });

  it("should extract IP from x-real-ip header when x-forwarded-for is absent", () => {
    const request = new Request("http://localhost", {
      headers: {
        "x-real-ip": "10.0.0.1",
      },
    });

    const ip = getClientIp(request);

    expect(ip).toBe("10.0.0.1");
  });

  it("should prefer x-forwarded-for over x-real-ip", () => {
    const request = new Request("http://localhost", {
      headers: {
        "x-forwarded-for": "192.168.1.1",
        "x-real-ip": "10.0.0.1",
      },
    });

    const ip = getClientIp(request);

    expect(ip).toBe("192.168.1.1");
  });

  it("should extract IP from cf-connecting-ip header (Cloudflare)", () => {
    const request = new Request("http://localhost", {
      headers: {
        "cf-connecting-ip": "203.0.113.1",
      },
    });

    const ip = getClientIp(request);

    expect(ip).toBe("203.0.113.1");
  });

  it("should prefer x-forwarded-for over cf-connecting-ip", () => {
    const request = new Request("http://localhost", {
      headers: {
        "x-forwarded-for": "192.168.1.1",
        "cf-connecting-ip": "203.0.113.1",
      },
    });

    const ip = getClientIp(request);

    expect(ip).toBe("192.168.1.1");
  });

  it("should prefer x-real-ip over cf-connecting-ip", () => {
    const request = new Request("http://localhost", {
      headers: {
        "x-real-ip": "10.0.0.1",
        "cf-connecting-ip": "203.0.113.1",
      },
    });

    const ip = getClientIp(request);

    expect(ip).toBe("10.0.0.1");
  });

  it("should return null when no IP headers are present", () => {
    const request = new Request("http://localhost", {
      headers: {},
    });

    const ip = getClientIp(request);

    expect(ip).toBeNull();
  });

  it("should return null when x-forwarded-for is empty string", () => {
    const request = new Request("http://localhost", {
      headers: {
        "x-forwarded-for": "",
      },
    });

    const ip = getClientIp(request);

    expect(ip).toBeNull();
  });

  it("should return null when x-forwarded-for contains only whitespace", () => {
    const request = new Request("http://localhost", {
      headers: {
        "x-forwarded-for": "   ",
      },
    });

    const ip = getClientIp(request);

    expect(ip).toBeNull();
  });

  it("should handle IPv6 addresses", () => {
    const request = new Request("http://localhost", {
      headers: {
        "x-forwarded-for": "2001:0db8:85a3:0000:0000:8a2e:0370:7334",
      },
    });

    const ip = getClientIp(request);

    expect(ip).toBe("2001:0db8:85a3:0000:0000:8a2e:0370:7334");
  });

  it("should handle mixed IPv4 and IPv6 in x-forwarded-for", () => {
    const request = new Request("http://localhost", {
      headers: {
        "x-forwarded-for": "192.168.1.1, 2001:db8::1",
      },
    });

    const ip = getClientIp(request);

    expect(ip).toBe("192.168.1.1");
  });
});

describe("hashIp", () => {
  const testSalt = "test-salt-12345";

  it("should generate consistent hash for same IP and salt", () => {
    const ip = "192.168.1.1";

    const hash1 = hashIp(ip, testSalt);
    const hash2 = hashIp(ip, testSalt);

    expect(hash1).toBe(hash2);
  });

  it("should generate different hashes for different IPs", () => {
    const ip1 = "192.168.1.1";
    const ip2 = "192.168.1.2";

    const hash1 = hashIp(ip1, testSalt);
    const hash2 = hashIp(ip2, testSalt);

    expect(hash1).not.toBe(hash2);
  });

  it("should generate different hashes for different salts", () => {
    const ip = "192.168.1.1";
    const salt1 = "salt1";
    const salt2 = "salt2";

    const hash1 = hashIp(ip, salt1);
    const hash2 = hashIp(ip, salt2);

    expect(hash1).not.toBe(hash2);
  });

  it("should return valid hex string (64 chars)", () => {
    const ip = "192.168.1.1";

    const hash = hashIp(ip, testSalt);

    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash.length).toBe(64);
  });

  it("should handle null IP by using sentinel value", () => {
    const hash1 = hashIp(null, testSalt);
    const hash2 = hashIp(null, testSalt);

    expect(hash1).toBe(hash2);
    expect(hash1).toMatch(/^[a-f0-9]{64}$/);
  });

  it("should produce same hash for null IP as empty string", () => {
    const hashNull = hashIp(null, testSalt);
    const hashEmpty = hashIp("", testSalt);

    // Both should use the "unknown" sentinel
    expect(hashNull).toBe(hashEmpty);
  });

  it("should hash IPv6 addresses", () => {
    const ip = "2001:0db8:85a3:0000:0000:8a2e:0370:7334";

    const hash = hashIp(ip, testSalt);

    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("should produce different hashes for similar IPs", () => {
    const ip1 = "192.168.1.1";
    const ip2 = "192.168.1.10";
    const ip3 = "192.168.1.100";

    const hash1 = hashIp(ip1, testSalt);
    const hash2 = hashIp(ip2, testSalt);
    const hash3 = hashIp(ip3, testSalt);

    expect(hash1).not.toBe(hash2);
    expect(hash1).not.toBe(hash3);
    expect(hash2).not.toBe(hash3);
  });

  it("should handle special IP addresses", () => {
    const loopback = "127.0.0.1";
    const broadcast = "255.255.255.255";
    const zero = "0.0.0.0";

    const hash1 = hashIp(loopback, testSalt);
    const hash2 = hashIp(broadcast, testSalt);
    const hash3 = hashIp(zero, testSalt);

    expect(hash1).toMatch(/^[a-f0-9]{64}$/);
    expect(hash2).toMatch(/^[a-f0-9]{64}$/);
    expect(hash3).toMatch(/^[a-f0-9]{64}$/);
    expect(hash1).not.toBe(hash2);
    expect(hash1).not.toBe(hash3);
    expect(hash2).not.toBe(hash3);
  });

  it("should be case-sensitive for IP addresses", () => {
    // IPv6 can have hex digits in different cases
    const ipLower = "2001:db8::1";
    const ipUpper = "2001:DB8::1";

    const hashLower = hashIp(ipLower, testSalt);
    const hashUpper = hashIp(ipUpper, testSalt);

    // Different cases should produce different hashes
    expect(hashLower).not.toBe(hashUpper);
  });

  it("should handle very long salt strings", () => {
    const ip = "192.168.1.1";
    const longSalt = "x".repeat(1000);

    const hash = hashIp(ip, longSalt);

    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("should handle empty salt (not recommended but should work)", () => {
    const ip = "192.168.1.1";
    const emptySalt = "";

    const hash = hashIp(ip, emptySalt);

    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("should produce avalanche effect (small change = big difference)", () => {
    const ip1 = "192.168.1.1";
    const ip2 = "192.168.1.2";

    const hash1 = hashIp(ip1, testSalt);
    const hash2 = hashIp(ip2, testSalt);

    // Count different characters (should be roughly half for good hash)
    let differences = 0;
    for (let i = 0; i < hash1.length; i++) {
      if (hash1[i] !== hash2[i]) {
        differences++;
      }
    }

    // At least 20% of characters should differ (conservative estimate)
    expect(differences).toBeGreaterThan(12);
  });
});

describe("integration: getClientIp + hashIp", () => {
  const testSalt = "integration-test-salt";

  it("should produce consistent hash for same request", () => {
    const request = new Request("http://localhost", {
      headers: {
        "x-forwarded-for": "192.168.1.1",
      },
    });

    const ip = getClientIp(request);
    const hash1 = hashIp(ip, testSalt);
    const hash2 = hashIp(ip, testSalt);

    expect(hash1).toBe(hash2);
  });

  it("should handle missing IP gracefully with sentinel hash", () => {
    const request = new Request("http://localhost", {
      headers: {},
    });

    const ip = getClientIp(request);
    const hash = hashIp(ip, testSalt);

    expect(ip).toBeNull();
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("should produce different hashes for different client IPs", () => {
    const request1 = new Request("http://localhost", {
      headers: {
        "x-forwarded-for": "192.168.1.1",
      },
    });

    const request2 = new Request("http://localhost", {
      headers: {
        "x-forwarded-for": "10.0.0.1",
      },
    });

    const ip1 = getClientIp(request1);
    const ip2 = getClientIp(request2);
    const hash1 = hashIp(ip1, testSalt);
    const hash2 = hashIp(ip2, testSalt);

    expect(hash1).not.toBe(hash2);
  });
});
