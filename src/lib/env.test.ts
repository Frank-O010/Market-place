import { describe, expect, it } from "vitest";
import { parseServerEnv } from "./env";

const base = { DATABASE_URL: "postgresql://localhost/db" };

describe("parseServerEnv", () => {
  it("accepts local development with dev sign-in", () => {
    const env = parseServerEnv({ ...base, NODE_ENV: "development", AUTH_PROVIDER: "dev" });
    expect(env.AUTH_PROVIDER).toBe("dev");
  });

  it("refuses dev sign-in in a production build unless explicitly allowed for tests", () => {
    expect(() => parseServerEnv({ ...base, NODE_ENV: "production", AUTH_PROVIDER: "dev" })).toThrow(/AUTH_PROVIDER/);
    expect(
      parseServerEnv({ ...base, NODE_ENV: "production", AUTH_PROVIDER: "dev", ALLOW_DEV_AUTH: "true" }).AUTH_PROVIDER,
    ).toBe("dev");
  });

  it("never allows dev sign-in on Vercel, even with the override", () => {
    expect(() =>
      parseServerEnv({ ...base, AUTH_PROVIDER: "dev", ALLOW_DEV_AUTH: "true", VERCEL_ENV: "preview" }),
    ).toThrow(/AUTH_PROVIDER/);
  });

  it("requires Clerk keys when Clerk is the provider", () => {
    expect(() => parseServerEnv({ ...base, AUTH_PROVIDER: "clerk" })).toThrow(/CLERK_SECRET_KEY/);
  });

  it("requires both Upstash variables or neither", () => {
    expect(() =>
      parseServerEnv({ ...base, AUTH_PROVIDER: "dev", UPSTASH_REDIS_REST_URL: "https://x.upstash.io" }),
    ).toThrow(/UPSTASH/);
  });

  it("fails clearly when DATABASE_URL is missing", () => {
    expect(() => parseServerEnv({ AUTH_PROVIDER: "dev" })).toThrow(/DATABASE_URL/);
  });
});
