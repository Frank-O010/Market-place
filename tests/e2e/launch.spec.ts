import { expect, expectAccessible, test } from "./helpers";
import { legalPages } from "../../src/config/site";

test.describe("launch readiness", () => {
  test("every public page passes an accessibility check", async ({ page }) => {
    await page.goto("/search?q=phone");
    const listing = await page.getByRole("article").first().getByRole("link").first().getAttribute("href");
    const paths = [
      "/",
      "/search?q=phone",
      "/c/electronics",
      listing!,
      "/s/wanjiku-electronics",
      "/help",
      "/offline",
      ...legalPages.map((p) => `/legal/${p.slug}`),
    ];
    for (const path of paths) {
      await page.goto(path);
      await page.getByRole("heading", { level: 1 }).first().waitFor();
      await expectAccessible(page);
    }
  });

  test("legal pages carry real draft text and say they await legal review", async ({ page }) => {
    for (const { slug, title } of legalPages) {
      await page.goto(`/legal/${slug}`);
      await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
      await expect(page.getByRole("note")).toContainText("hasn't been reviewed by a lawyer");
      expect(await page.getByRole("heading", { level: 2 }).count()).toBeGreaterThan(1);
    }
  });

  test("the app is installable and works offline", async ({ page, request }) => {
    const manifest = await (await request.get("/manifest.webmanifest")).json();
    expect(manifest.short_name).toBe("Soko");
    expect(manifest.display).toBe("standalone");
    expect(manifest.icons.map((i: { sizes: string }) => i.sizes)).toEqual(
      expect.arrayContaining(["192x192", "512x512"]),
    );
    for (const icon of manifest.icons) expect((await request.get(icon.src)).status()).toBe(200);

    const sw = await request.get("/sw.js");
    expect(sw.status()).toBe(200);
    expect(sw.headers()["cache-control"]).toContain("no-cache");

    await page.goto("/");
    await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
    await page.reload(); // the service worker now controls the page
    await page.context().setOffline(true);
    await page.goto("/search?q=anything").catch(() => undefined);
    await expect(page.getByRole("heading", { name: "You're offline" })).toBeVisible();
    await page.context().setOffline(false);
  });

  test("the sign-in status check explains the visitor's own session", async ({ request }) => {
    const response = await request.get("/api/auth/status");
    expect(response.status()).toBe(200);
    expect(response.headers()["cache-control"]).toContain("no-store");
    expect(await response.json()).toMatchObject({ signedIn: false, account: "signed-out" });
  });

  test("the health check reports the database is reachable", async ({ request }) => {
    const response = await request.get("/api/health");
    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });
});
