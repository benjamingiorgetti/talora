/**
 * Tests for config.ts
 *
 * requireEnv, optionalEnv, and parsePort are internal functions — they are not
 * exported. We test their behavior through two strategies:
 *
 * 1. Dynamic import with controlled process.env: lets us test requireEnv's
 *    throw path and optionalEnv's fallback behavior by manipulating env vars
 *    before each import.
 *
 * 2. The already-loaded config object: for parsePort we can only test the
 *    "valid port" path via the PORT env var that the test runner sets. Edge
 *    cases (invalid / out-of-range) are tested by importing the module fresh
 *    with a patched PORT value.
 *
 * IMPORTANT: bun's module cache means a plain `import config from '../config'`
 * is always the same instance. We force a fresh evaluation by appending a
 * query-string cache-buster to the import path — Bun treats different specifiers
 * as different modules.
 */

import { describe, it, expect, beforeEach, afterEach } from "bun:test";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minimum required env vars so config.ts does not throw on import. */
const BASE_ENV: Record<string, string> = {
  DATABASE_URL: "postgresql://test:test@localhost/test",
  JWT_SECRET: "test-secret",
  ADMIN_EMAIL: "admin@example.com",
  ADMIN_PASSWORD: "secret",
  EVOLUTION_API_URL: "http://localhost:8080",
  EVOLUTION_API_KEY: "test-key",
  OPENAI_API_KEY: "sk-test",
};

/**
 * Load a fresh copy of config.ts with the given env vars set.
 * We append a unique cache-buster so Bun does not return a cached module.
 */
let importCounter = 0;
async function loadConfig(
  overrides: Record<string, string | undefined> = {}
): Promise<typeof import("../config")> {
  // Snapshot original env
  const original: Record<string, string | undefined> = {};
  const allKeys = [...Object.keys(BASE_ENV), ...Object.keys(overrides)];
  for (const key of allKeys) {
    original[key] = process.env[key];
  }

  // Apply env
  for (const [k, v] of Object.entries(BASE_ENV)) {
    process.env[k] = v;
  }
  for (const [k, v] of Object.entries(overrides)) {
    if (v === undefined) {
      delete process.env[k];
    } else {
      process.env[k] = v;
    }
  }

  try {
    importCounter++;
    // Cache-buster forces Bun to re-evaluate the module
    const mod = await import(`../config?t=${importCounter}`);
    return mod;
  } finally {
    // Restore env
    for (const key of allKeys) {
      if (original[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = original[key]!;
      }
    }
  }
}

// ---------------------------------------------------------------------------
// requireEnv (tested indirectly — required fields in config)
// ---------------------------------------------------------------------------

describe("requireEnv behavior (via config required fields)", () => {
  it("should return the value when the env var is present", async () => {
    const mod = await loadConfig({ DATABASE_URL: "postgresql://custom:pass@db/mydb" });
    expect(mod.config.databaseUrl).toBe("postgresql://custom:pass@db/mydb");
  });

  it("should throw when a required env var is missing", async () => {
    // Remove DATABASE_URL so config.ts throws during module evaluation
    await expect(loadConfig({ DATABASE_URL: undefined })).rejects.toThrow(
      "Missing required environment variable: DATABASE_URL"
    );
  });

  it("should throw with the correct variable name in the message", async () => {
    await expect(loadConfig({ JWT_SECRET: undefined })).rejects.toThrow(
      "Missing required environment variable: JWT_SECRET"
    );
  });
});

// ---------------------------------------------------------------------------
// optionalEnv (tested indirectly — optional fields in config)
// ---------------------------------------------------------------------------

describe("optionalEnv behavior (via config optional fields)", () => {
  it("should return the provided value when the env var is set", async () => {
    const mod = await loadConfig({ CORS_ORIGIN: "http://example.com:3000" });
    expect(mod.config.corsOrigin).toBe("http://example.com:3000");
  });

  it("should return the fallback when the env var is absent", async () => {
    // CORS_ORIGIN is optional with fallback 'http://localhost:3000'
    const mod = await loadConfig({ CORS_ORIGIN: undefined });
    expect(mod.config.corsOrigin).toBe("http://localhost:3000");
  });

  it("should return the fallback for TIMEZONE when absent", async () => {
    const mod = await loadConfig({ TIMEZONE: undefined });
    expect(mod.config.timezone).toBe("America/Argentina/Buenos_Aires");
  });
});

// ---------------------------------------------------------------------------
// parsePort (tested indirectly — config.port field)
// ---------------------------------------------------------------------------

describe("parsePort behavior (via config.port)", () => {
  it("should parse a valid port string to a number", async () => {
    const mod = await loadConfig({ PORT: "4200" });
    expect(mod.config.port).toBe(4200);
  });

  it("should fall back to 3001 when PORT is an invalid string", async () => {
    const mod = await loadConfig({ PORT: "not-a-number" });
    expect(mod.config.port).toBe(3001);
  });

  it("should fall back to 3001 when PORT is 0 (below valid range)", async () => {
    const mod = await loadConfig({ PORT: "0" });
    expect(mod.config.port).toBe(3001);
  });

  it("should fall back to 3001 when PORT exceeds 65535", async () => {
    const mod = await loadConfig({ PORT: "99999" });
    expect(mod.config.port).toBe(3001);
  });

  it("should fall back to 3001 when PORT is absent", async () => {
    const mod = await loadConfig({ PORT: undefined });
    expect(mod.config.port).toBe(3001);
  });

  it("should accept port 65535 (upper boundary)", async () => {
    const mod = await loadConfig({ PORT: "65535" });
    expect(mod.config.port).toBe(65535);
  });

  it("should accept port 1 (lower boundary)", async () => {
    const mod = await loadConfig({ PORT: "1" });
    expect(mod.config.port).toBe(1);
  });
});
