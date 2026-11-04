import { describe, expect, it } from "vitest";
import { buildCsp, securityHeaders } from "./security-headers";

describe("buildCsp", () => {
  const prod = buildCsp({ isDev: false, siteUrl: "https://soko.example" });

  it("blocks framing, plugins and foreign form posts", () => {
    expect(prod).toContain("frame-ancestors 'none'");
    expect(prod).toContain("object-src 'none'");
    expect(prod).toContain("form-action 'self'");
    expect(prod).toContain("base-uri 'self'");
  });

  it("does not allow eval in production but does in development", () => {
    expect(prod).not.toContain("unsafe-eval");
    expect(buildCsp({ isDev: true, siteUrl: "http://localhost:3000" })).toContain("'unsafe-eval'");
  });

  it("allows the site's own Clerk domain", () => {
    expect(prod).toContain("https://clerk.soko.example");
  });

  it("upgrades insecure requests in production", () => {
    expect(prod).toContain("upgrade-insecure-requests");
  });
});

describe("securityHeaders", () => {
  it("sends HSTS only in production", () => {
    const keys = (isDev: boolean) => securityHeaders({ isDev, siteUrl: "https://soko.example" }).map((h) => h.key);
    expect(keys(false)).toContain("Strict-Transport-Security");
    expect(keys(true)).not.toContain("Strict-Transport-Security");
    expect(keys(false)).toEqual(
      expect.arrayContaining(["X-Content-Type-Options", "Referrer-Policy", "Permissions-Policy"]),
    );
  });
});
