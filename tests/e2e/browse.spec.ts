import { expect, expectAccessible, test } from "./helpers";

test.describe("guest browsing", () => {
  test("home page shows the latest Nairobi listings without signing in", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Buy and sell safely");
    const listings = page.getByRole("region", { name: /Latest in Nairobi/ }).getByRole("article");
    await expect(listings.first()).toBeVisible();
    expect(await listings.count()).toBe(12);
    await expect(
      page.getByRole("navigation", { name: "Categories" }).getByRole("link", { name: "Phones & Tablets" }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
    await expect(page.getByRole("search")).toBeVisible();
    await expectAccessible(page);
  });

  test("only active listings are shown publicly", async ({ page }) => {
    await page.goto("/");
    // Seeded as DRAFT and PAUSED respectively.
    await expect(page.getByText("Denim jacket, size L")).toHaveCount(0);
    await expect(page.getByText("Treadmill, foldable, 2HP")).toHaveCount(0);
  });

  test("help and legal pages render with a WhatsApp support link", async ({ page }) => {
    await page.goto("/help");
    await expect(page.getByRole("main").getByRole("link", { name: /WhatsApp/ })).toHaveAttribute(
      "href",
      /^https:\/\/wa\.me\//,
    );
    await expectAccessible(page);
    await page.goto("/legal/privacy");
    await expect(page.getByRole("heading", { name: "Privacy policy" })).toBeVisible();
    await expect(page.getByRole("note")).toContainText("Draft");
  });

  test("unknown pages return a helpful 404", async ({ page }) => {
    for (const path of ["/no-such-page", "/legal/does-not-exist"]) {
      const response = await page.goto(path);
      expect(response?.status(), path).toBe(404);
      await expect(page.getByText("We couldn't find that page")).toBeVisible();
    }
  });
});

test("responses carry security headers", async ({ request }) => {
  const response = await request.get("/");
  const headers = response.headers();
  expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(headers["content-security-policy"]).toContain("object-src 'none'");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["strict-transport-security"]).toContain("max-age=");
  expect(headers["x-powered-by"]).toBeUndefined();
});
