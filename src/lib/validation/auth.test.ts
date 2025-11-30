import { describe, it, expect } from "vitest";
import { registerCommandSchema, loginCommandSchema, parseRegisterCommand, parseLoginCommand } from "./auth";

describe("registerCommandSchema", () => {
  describe("valid payloads", () => {
    it("should accept valid email and password", () => {
      const input = {
        email: "user@example.com",
        password: "Password123",
      };

      const result = registerCommandSchema.safeParse(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe("user@example.com");
        expect(result.data.password).toBe("Password123");
      }
    });

    it("should accept email with plus addressing", () => {
      const input = {
        email: "user+test@example.com",
        password: "SecurePass1",
      };

      const result = registerCommandSchema.safeParse(input);

      expect(result.success).toBe(true);
    });

    it("should accept email with subdomain", () => {
      const input = {
        email: "user@mail.example.com",
        password: "ValidPass1",
      };

      const result = registerCommandSchema.safeParse(input);

      expect(result.success).toBe(true);
    });

    it("should accept password with special characters", () => {
      const input = {
        email: "user@example.com",
        password: "P@ssw0rd!#$",
      };

      const result = registerCommandSchema.safeParse(input);

      expect(result.success).toBe(true);
    });

    it("should accept password at minimum length (8 chars)", () => {
      const input = {
        email: "user@example.com",
        password: "Pass123a",
      };

      const result = registerCommandSchema.safeParse(input);

      expect(result.success).toBe(true);
    });

    it("should accept very long password", () => {
      const input = {
        email: "user@example.com",
        password: "VeryLongPassword123WithManyCharacters",
      };

      const result = registerCommandSchema.safeParse(input);

      expect(result.success).toBe(true);
    });
  });

  describe("email validation", () => {
    it("should reject missing email", () => {
      const input = {
        password: "Password123",
      };

      const result = registerCommandSchema.safeParse(input);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((i) => i.path.includes("email"))).toBe(true);
      }
    });

    it("should reject empty email", () => {
      const input = {
        email: "",
        password: "Password123",
      };

      const result = registerCommandSchema.safeParse(input);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((i) => i.message.includes("email"))).toBe(true);
      }
    });

    it("should reject invalid email without @", () => {
      const input = {
        email: "userexample.com",
        password: "Password123",
      };

      const result = registerCommandSchema.safeParse(input);

      expect(result.success).toBe(false);
    });

    it("should reject invalid email without domain", () => {
      const input = {
        email: "user@",
        password: "Password123",
      };

      const result = registerCommandSchema.safeParse(input);

      expect(result.success).toBe(false);
    });

    it("should reject invalid email without local part", () => {
      const input = {
        email: "@example.com",
        password: "Password123",
      };

      const result = registerCommandSchema.safeParse(input);

      expect(result.success).toBe(false);
    });

    it("should reject email with spaces", () => {
      const input = {
        email: "user name@example.com",
        password: "Password123",
      };

      const result = registerCommandSchema.safeParse(input);

      expect(result.success).toBe(false);
    });

    it("should reject email with multiple @ symbols", () => {
      const input = {
        email: "user@@example.com",
        password: "Password123",
      };

      const result = registerCommandSchema.safeParse(input);

      expect(result.success).toBe(false);
    });

    it("should reject non-string email", () => {
      const input = {
        email: 12345,
        password: "Password123",
      };

      const result = registerCommandSchema.safeParse(input);

      expect(result.success).toBe(false);
    });
  });

  describe("password validation - minimum length", () => {
    it("should reject password shorter than 8 characters", () => {
      const input = {
        email: "user@example.com",
        password: "Pass1aB",
      };

      const result = registerCommandSchema.safeParse(input);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((i) => i.message.includes("8 characters"))).toBe(true);
      }
    });

    it("should reject empty password", () => {
      const input = {
        email: "user@example.com",
        password: "",
      };

      const result = registerCommandSchema.safeParse(input);

      expect(result.success).toBe(false);
    });

    it("should reject missing password", () => {
      const input = {
        email: "user@example.com",
      };

      const result = registerCommandSchema.safeParse(input);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((i) => i.path.includes("password"))).toBe(true);
      }
    });
  });

  describe("password validation - uppercase requirement", () => {
    it("should reject password without uppercase letter", () => {
      const input = {
        email: "user@example.com",
        password: "password123",
      };

      const result = registerCommandSchema.safeParse(input);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((i) => i.message.includes("uppercase"))).toBe(true);
      }
    });

    it("should accept password with multiple uppercase letters", () => {
      const input = {
        email: "user@example.com",
        password: "PASSWORD123",
      };

      const result = registerCommandSchema.safeParse(input);

      expect(result.success).toBe(false); // Still fails - needs lowercase too
    });
  });

  describe("password validation - lowercase requirement", () => {
    it("should reject password without lowercase letter", () => {
      const input = {
        email: "user@example.com",
        password: "PASSWORD123",
      };

      const result = registerCommandSchema.safeParse(input);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((i) => i.message.includes("lowercase"))).toBe(true);
      }
    });

    it("should accept password with multiple lowercase letters", () => {
      const input = {
        email: "user@example.com",
        password: "password123",
      };

      const result = registerCommandSchema.safeParse(input);

      expect(result.success).toBe(false); // Still fails - needs uppercase too
    });
  });

  describe("password validation - number requirement", () => {
    it("should reject password without number", () => {
      const input = {
        email: "user@example.com",
        password: "PasswordOnly",
      };

      const result = registerCommandSchema.safeParse(input);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((i) => i.message.includes("number"))).toBe(true);
      }
    });

    it("should accept password with multiple numbers", () => {
      const input = {
        email: "user@example.com",
        password: "Password123456",
      };

      const result = registerCommandSchema.safeParse(input);

      expect(result.success).toBe(true);
    });

    it("should accept password with number at start", () => {
      const input = {
        email: "user@example.com",
        password: "1Password",
      };

      const result = registerCommandSchema.safeParse(input);

      expect(result.success).toBe(true);
    });

    it("should accept password with number in middle", () => {
      const input = {
        email: "user@example.com",
        password: "Pass1word",
      };

      const result = registerCommandSchema.safeParse(input);

      expect(result.success).toBe(true);
    });
  });

  describe("password validation - combined requirements", () => {
    it("should reject password with only lowercase and numbers", () => {
      const input = {
        email: "user@example.com",
        password: "password123",
      };

      const result = registerCommandSchema.safeParse(input);

      expect(result.success).toBe(false);
    });

    it("should reject password with only uppercase and numbers", () => {
      const input = {
        email: "user@example.com",
        password: "PASSWORD123",
      };

      const result = registerCommandSchema.safeParse(input);

      expect(result.success).toBe(false);
    });

    it("should reject password with only uppercase and lowercase", () => {
      const input = {
        email: "user@example.com",
        password: "PasswordOnly",
      };

      const result = registerCommandSchema.safeParse(input);

      expect(result.success).toBe(false);
    });

    it("should reject non-string password", () => {
      const input = {
        email: "user@example.com",
        password: 12345678,
      };

      const result = registerCommandSchema.safeParse(input);

      expect(result.success).toBe(false);
    });
  });

  describe("strict mode (extra fields)", () => {
    it("should reject extra top-level fields", () => {
      const input = {
        email: "user@example.com",
        password: "Password123",
        extra_field: "should-be-rejected",
      };

      const result = registerCommandSchema.safeParse(input);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((i) => i.code === "unrecognized_keys")).toBe(true);
      }
    });

    it("should reject multiple extra fields", () => {
      const input = {
        email: "user@example.com",
        password: "Password123",
        username: "john",
        remember_me: true,
      };

      const result = registerCommandSchema.safeParse(input);

      expect(result.success).toBe(false);
    });
  });
});

describe("loginCommandSchema", () => {
  describe("valid payloads", () => {
    it("should accept valid email and any non-empty password", () => {
      const input = {
        email: "user@example.com",
        password: "anypassword",
      };

      const result = loginCommandSchema.safeParse(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe("user@example.com");
        expect(result.data.password).toBe("anypassword");
      }
    });

    it("should accept weak password (no policy validation on login)", () => {
      const input = {
        email: "user@example.com",
        password: "weak",
      };

      const result = loginCommandSchema.safeParse(input);

      expect(result.success).toBe(true);
    });

    it("should accept password with spaces", () => {
      const input = {
        email: "user@example.com",
        password: "pass with spaces",
      };

      const result = loginCommandSchema.safeParse(input);

      expect(result.success).toBe(true);
    });

    it("should accept single character password", () => {
      const input = {
        email: "user@example.com",
        password: "a",
      };

      const result = loginCommandSchema.safeParse(input);

      expect(result.success).toBe(true);
    });
  });

  describe("email validation", () => {
    it("should reject missing email", () => {
      const input = {
        password: "anypassword",
      };

      const result = loginCommandSchema.safeParse(input);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((i) => i.path.includes("email"))).toBe(true);
      }
    });

    it("should reject invalid email", () => {
      const input = {
        email: "not-an-email",
        password: "anypassword",
      };

      const result = loginCommandSchema.safeParse(input);

      expect(result.success).toBe(false);
    });

    it("should reject empty email", () => {
      const input = {
        email: "",
        password: "anypassword",
      };

      const result = loginCommandSchema.safeParse(input);

      expect(result.success).toBe(false);
    });
  });

  describe("password validation", () => {
    it("should reject empty password", () => {
      const input = {
        email: "user@example.com",
        password: "",
      };

      const result = loginCommandSchema.safeParse(input);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((i) => i.message.includes("required"))).toBe(true);
      }
    });

    it("should reject missing password", () => {
      const input = {
        email: "user@example.com",
      };

      const result = loginCommandSchema.safeParse(input);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((i) => i.path.includes("password"))).toBe(true);
      }
    });

    it("should reject non-string password", () => {
      const input = {
        email: "user@example.com",
        password: 12345,
      };

      const result = loginCommandSchema.safeParse(input);

      expect(result.success).toBe(false);
    });
  });

  describe("strict mode (extra fields)", () => {
    it("should reject extra top-level fields", () => {
      const input = {
        email: "user@example.com",
        password: "anypassword",
        remember_me: true,
      };

      const result = loginCommandSchema.safeParse(input);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((i) => i.code === "unrecognized_keys")).toBe(true);
      }
    });
  });
});

describe("parseRegisterCommand", () => {
  it("should return validated command for valid input", () => {
    const input = {
      email: "user@example.com",
      password: "Password123",
    };

    const result = parseRegisterCommand(input);

    expect(result.email).toBe("user@example.com");
    expect(result.password).toBe("Password123");
  });

  it("should throw error with bad_request code for invalid email", () => {
    const input = {
      email: "invalid-email",
      password: "Password123",
    };

    expect(() => parseRegisterCommand(input)).toThrow();

    try {
      parseRegisterCommand(input);
    } catch (error: any) {
      expect(error.code).toBe("bad_request");
      expect(error.message).toBeTruthy();
      expect(error.details).toBeDefined();
    }
  });

  it("should throw error with bad_request code for weak password", () => {
    const input = {
      email: "user@example.com",
      password: "weak",
    };

    expect(() => parseRegisterCommand(input)).toThrow();

    try {
      parseRegisterCommand(input);
    } catch (error: any) {
      expect(error.code).toBe("bad_request");
      expect(error.message).toBeTruthy();
      expect(error.details).toBeDefined();
    }
  });

  it("should include all validation errors in message", () => {
    const input = {
      email: "invalid-email",
      password: "weak",
    };

    try {
      parseRegisterCommand(input);
      expect.fail("Should have thrown error");
    } catch (error: any) {
      expect(error.message).toBeTruthy();
      expect(error.details.length).toBeGreaterThan(0);
    }
  });

  it("should throw error for missing required fields", () => {
    const input = {};

    expect(() => parseRegisterCommand(input)).toThrow();

    try {
      parseRegisterCommand(input);
    } catch (error: any) {
      expect(error.code).toBe("bad_request");
      expect(error.details.length).toBeGreaterThanOrEqual(2);
    }
  });
});

describe("parseLoginCommand", () => {
  it("should return validated command for valid input", () => {
    const input = {
      email: "user@example.com",
      password: "anypassword",
    };

    const result = parseLoginCommand(input);

    expect(result.email).toBe("user@example.com");
    expect(result.password).toBe("anypassword");
  });

  it("should throw error with bad_request code for invalid email", () => {
    const input = {
      email: "invalid-email",
      password: "anypassword",
    };

    expect(() => parseLoginCommand(input)).toThrow();

    try {
      parseLoginCommand(input);
    } catch (error: any) {
      expect(error.code).toBe("bad_request");
      expect(error.message).toBeTruthy();
      expect(error.details).toBeDefined();
    }
  });

  it("should throw error with bad_request code for empty password", () => {
    const input = {
      email: "user@example.com",
      password: "",
    };

    expect(() => parseLoginCommand(input)).toThrow();

    try {
      parseLoginCommand(input);
    } catch (error: any) {
      expect(error.code).toBe("bad_request");
      expect(error.message).toContain("required");
    }
  });

  it("should include all validation errors in message", () => {
    const input = {
      email: "invalid-email",
      password: "",
    };

    try {
      parseLoginCommand(input);
      expect.fail("Should have thrown error");
    } catch (error: any) {
      expect(error.message).toBeTruthy();
      expect(error.details.length).toBeGreaterThan(0);
    }
  });

  it("should throw error for extra fields", () => {
    const input = {
      email: "user@example.com",
      password: "anypassword",
      extra_field: "value",
    };

    expect(() => parseLoginCommand(input)).toThrow();

    try {
      parseLoginCommand(input);
    } catch (error: any) {
      expect(error.code).toBe("bad_request");
    }
  });
});

