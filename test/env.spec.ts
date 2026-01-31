import { describe, it, expect, beforeEach } from "vitest";
import { createEnv, EnvValidationError } from "../src";

describe("safe-env-lite MVP", () => {
  const OLD = { ...process.env };

  beforeEach(() => {
    process.env = { ...OLD };
    delete process.env.PORT;
    delete process.env.NODE_ENV;
    delete process.env.DEBUG;
    delete process.env.DATABASE_URL;
  });

  it("applies defaults and coercion", () => {
    process.env.PORT = "4000";
    process.env.DEBUG = "true";
    process.env.DATABASE_URL = "postgres://x";

    const env = createEnv({
      PORT: { type: "number", default: 3000 },
      DEBUG: { type: "boolean", default: false },
      DATABASE_URL: { type: "string", required: true }
    } as const);

    expect(env.PORT).toBe(4000);
    expect(env.DEBUG).toBe(true);
    expect(env.DATABASE_URL).toBe("postgres://x");
  });

  it("throws on missing required and bad number", () => {
    process.env.PORT = "notanumber";
    // missing DATABASE_URL
    expect(() => {
      createEnv({
        PORT: { type: "number" },
        DATABASE_URL: { type: "string", required: true }
      } as const);
    }).toThrow(EnvValidationError);
  });

  it("validates enums", () => {
    process.env.NODE_ENV = "production";
    const env = createEnv({
      NODE_ENV: ["development", "test", "production"]
    } as const);
    expect(env.NODE_ENV).toBe("production");
  });
});
