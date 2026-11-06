import { describe, expect, it } from "vitest";
import { describeClerkKeys, frontendApiFromPublishableKey } from "./clerk-diagnostics";

describe("Clerk key diagnostics", () => {
  it("reads the Frontend API host from a publishable key", () => {
    expect(frontendApiFromPublishableKey("pk_test_ZmFrZS10ZXN0LmNsZXJrLmFjY291bnRzLmRldiQ=")).toBe(
      "fake-test.clerk.accounts.dev",
    );
    expect(frontendApiFromPublishableKey("not-a-key")).toBeNull();
    expect(frontendApiFromPublishableKey(undefined)).toBeNull();
  });

  it("flags test and live keys that don't match, without revealing them", async () => {
    const result = await describeClerkKeys("pk_live_Y2xlcmsuc29rby5leGFtcGxlJA==", undefined);
    expect(result).toEqual({
      publishableKeyMode: "live",
      secretKeyMode: "missing",
      modesMatch: false,
      frontendApi: "clerk.soko.example",
      sameInstance: null,
    });
    expect(JSON.stringify(result)).not.toContain("pk_live");
  });
});
