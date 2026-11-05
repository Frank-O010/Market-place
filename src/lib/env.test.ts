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

  it("requires both Turnstile keys or neither", () => {
    const dev = { ...base, AUTH_PROVIDER: "dev" };
    expect(() => parseServerEnv({ ...dev, TURNSTILE_SECRET_KEY: "secret" })).toThrow(/TURNSTILE/);
    expect(() => parseServerEnv({ ...dev, NEXT_PUBLIC_TURNSTILE_SITE_KEY: "site" })).toThrow(/TURNSTILE/);
    expect(parseServerEnv({ ...dev, TURNSTILE_SECRET_KEY: "s", NEXT_PUBLIC_TURNSTILE_SITE_KEY: "k" })).toBeTruthy();
  });

  it("defaults the deleted-account retention to 30 days", () => {
    expect(parseServerEnv({ ...base, AUTH_PROVIDER: "dev" }).DELETED_ACCOUNT_RETENTION_DAYS).toBe(30);
  });

  it("fails clearly when DATABASE_URL is missing", () => {
    expect(() => parseServerEnv({ AUTH_PROVIDER: "dev" })).toThrow(/DATABASE_URL/);
  });

  it("requires the full set of R2 variables and a public image origin", () => {
    const dev = { ...base, AUTH_PROVIDER: "dev" };
    expect(() => parseServerEnv({ ...dev, R2_BUCKET: "photos" })).toThrow(/R2_ACCOUNT_ID/);
    const r2 = { R2_ACCOUNT_ID: "a", R2_ACCESS_KEY_ID: "b", R2_SECRET_ACCESS_KEY: "c", R2_BUCKET: "d" };
    expect(() => parseServerEnv({ ...dev, ...r2 })).toThrow(/NEXT_PUBLIC_IMAGE_ORIGIN/);
    expect(parseServerEnv({ ...dev, ...r2, NEXT_PUBLIC_IMAGE_ORIGIN: "https://img.soko.example" }).R2_BUCKET).toBe("d");
  });

  it("requires both Meilisearch variables or neither", () => {
    expect(() => parseServerEnv({ ...base, AUTH_PROVIDER: "dev", MEILISEARCH_HOST: "https://ms.example" })).toThrow(
      /MEILISEARCH_ADMIN_KEY/,
    );
  });
});
