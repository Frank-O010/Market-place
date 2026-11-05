import sharp from "sharp";
import { expect, expectAccessible, seeded, signInAs, signUp, test } from "./helpers";

/** A real photo, generated on the fly so the repo doesn't carry binary fixtures. */
async function photo(colour = "#0F766E") {
  const buffer = await sharp({ create: { width: 900, height: 700, channels: 3, background: colour } })
    .jpeg({ quality: 80 })
    .withMetadata({ exif: { IFD0: { Make: "TestPhone" } } })
    .toBuffer();
  return { name: "item.jpg", mimeType: "image/jpeg", buffer };
}

test.describe("selling", () => {
  test("a new seller sets up a shop, lists an item with a photo, a moderator approves it, and a guest finds it with a typo", async ({
    page,
    browser,
  }, testInfo) => {
    const stamp = `${testInfo.project.name}${Date.now().toString().slice(-6)}`;
    const title = `Marimba hand-carved ${stamp}`;

    await signUp(page, `Seller ${stamp}`);
    await page.goto("/sell");
    await page.getByRole("link", { name: "Set up my shop" }).click();
    await expectAccessible(page);
    await page.getByLabel("Shop name").fill(`Marimba Crafts ${stamp}`);
    await expect(page.getByLabel("Shop address")).toHaveValue(`marimba-crafts-${stamp}`);
    await page.getByLabel("Where you sell from").selectOption("Kilimani");
    await page.getByRole("button", { name: "Create my shop" }).click();
    await page.waitForURL("**/sell?welcome=1");

    await page.getByRole("link", { name: "List an item" }).first().click();
    // Validation keeps what was typed.
    await page.getByLabel("Title").fill(title);
    await page.getByRole("button", { name: "Save and add photos" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Choose a category" })).toBeVisible();
    await expect(page.getByLabel("Title")).toHaveValue(title);
    await expectAccessible(page);

    await page.getByLabel("Category").selectOption({ label: "Decor" });
    await page.getByLabel("Price (KES)").first().fill("4,500");
    await page.getByLabel("Condition").selectOption("NEW");
    await expect(page.getByLabel("Where is the item?")).toHaveValue("Kilimani");
    await page
      .getByLabel("Description")
      .fill("A hand-carved wooden marimba made in Kenya. About 60cm wide, plays well.");
    await page.getByLabel("Material").fill("Mahogany");
    await page.getByRole("button", { name: "Save and add photos" }).click();
    await page.waitForURL(/\/sell\/listings\/[a-z0-9]+\/edit\?step=photos/);

    // Publishing needs a photo.
    await page.getByRole("button", { name: "Publish" }).click();
    await expect(page.getByText("Add at least one photo before publishing.").first()).toBeVisible();

    await page.getByLabel("Choose photos to upload").setInputFiles(await photo());
    const photos = page.getByRole("list", { name: "Listing photos" }).getByRole("listitem");
    await expect(photos).toHaveCount(1);
    await expect(page.getByLabel("Describe photo 1")).toHaveValue(`${title}, photo 1`);
    await expect(page).toHaveTitle(/Edit listing/);
    await expectAccessible(page);

    // A new seller's first listing waits for a moderator.
    await page.getByRole("button", { name: "Publish" }).click();
    await expect(page.getByText("In review", { exact: true })).toBeVisible();
    await expect(page.getByText(/Waiting for a moderator/)).toBeVisible();

    const modContext = await browser.newContext(testInfo.project.use);
    const moderator = await modContext.newPage();
    await signInAs(moderator, seeded.moderator, "/admin/moderation");
    const card = moderator
      .getByTestId("listing-queue")
      .filter({ visible: true })
      .getByRole("listitem")
      .filter({ hasText: title });
    await expect(card).toBeVisible();
    await expectAccessible(moderator);
    await card.getByRole("button", { name: "Approve" }).click();
    await expect(card).toHaveCount(0);
    await modContext.close();

    await page.reload();
    await expect(page.getByText("Active", { exact: true }).filter({ visible: true })).toBeVisible();
    await page.getByRole("link", { name: "View live listing" }).click();
    await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
    await expect(page.getByText("Mahogany")).toBeVisible();
    const photoSrc = await page.getByRole("img", { name: `${title}, photo 1` }).getAttribute("src");
    expect(photoSrc).toMatch(/\.webp$/);
    const image = await page.request.get(photoSrc!);
    expect(image.headers()["content-type"]).toBe("image/webp");
    // Re-encoded: the EXIF block written by the "phone" is gone.
    expect((await sharp(await image.body()).metadata()).exif).toBeUndefined();

    // A signed-out buyer finds it by searching with a typo.
    const guestContext = await browser.newContext(testInfo.project.use);
    const guest = await guestContext.newPage();
    await guest.goto("/");
    await guest.getByRole("search").getByRole("searchbox").fill("marimbaa");
    await guest.getByRole("search").getByRole("searchbox").press("Enter");
    await guest.waitForURL("**/search?q=marimbaa");
    await expect(guest).toHaveTitle(/Search/);
    await expect(async () => {
      await guest.reload();
      await expect(guest.getByRole("link", { name: title })).toBeVisible({ timeout: 1000 });
    }).toPass({ timeout: 15_000 });
    await expectAccessible(guest);
    await guestContext.close();
  });

  test("uploads with a fake extension are rejected", async ({ page }) => {
    await signInAs(page, seeded.seller, "/sell/listings");
    await page
      .getByRole("link", { name: /iPhone 13/ })
      .first()
      .click();
    await page.getByLabel("Choose photos to upload").setInputFiles({
      name: "holiday.jpg",
      mimeType: "image/jpeg",
      buffer: Buffer.from("#!/bin/sh\necho this is not a photo\n"),
    });
    await expect(page.getByText(/holiday\.jpg: That file isn't a photo we can use/)).toBeVisible();
  });

  test("sellers can't open or change another seller's listing", async ({ page }) => {
    await signInAs(page, seeded.seller, "/sell/listings");
    const editHref = await page
      .getByRole("link", { name: /iPhone 13/ })
      .first()
      .getAttribute("href");
    expect(editHref).toMatch(/\/sell\/listings\/.+\/edit/);

    await signInAs(page, "Baraka Ochieng", "/sell");
    const response = await page.goto(editHref!);
    await expect(page.getByText("We couldn't find that page")).toBeVisible();
    expect(response?.status()).toBe(200); // streamed page; the content is the not-found screen
    await expect(page.getByLabel("Title")).toHaveCount(0);
  });
});

test.describe("browsing", () => {
  test("category pages list items and filters narrow them", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("navigation", { name: "Categories" }).getByRole("link", { name: "Phones & Tablets" }).click();
    await page.waitForURL("**/c/phones-tablets");
    await expect(page.getByRole("heading", { level: 1, name: "Phones & Tablets" })).toBeVisible();
    // Page titles stream in after the content for browsers; wait so the accessibility check sees it.
    await expect(page).toHaveTitle(/Phones & Tablets for sale/);
    const results = page.getByRole("region", { name: "Results" }).getByRole("article");
    await expect(results.first()).toBeVisible();
    const before = await results.count();
    await expectAccessible(page);

    await page.goto("/c/phones-tablets?max=20000");
    await expect(results.first()).toBeVisible();
    const cheaper = await results.count();
    expect(cheaper).toBeLessThan(before);
    for (const price of await page.getByRole("region", { name: "Results" }).locator("article").allInnerTexts()) {
      const amount = Number(/Ksh\s?([\d,]+)/.exec(price)?.[1]?.replace(/,/g, ""));
      expect(amount).toBeLessThanOrEqual(20000);
    }
  });

  test("product pages have details, structured data and a seller link", async ({ page }) => {
    await page.goto("/c/phones-tablets");
    await page.getByRole("region", { name: "Results" }).getByRole("article").first().getByRole("link").click();
    await page.waitForURL(/\/l\/[a-z0-9-]+-[a-z0-9]+$/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Breadcrumb" })).toContainText("Phones & Tablets");
    await expect(page).toHaveTitle(/ in /);
    const jsonLd = await page.locator('script[type="application/ld+json"]').allTextContents();
    const product = jsonLd.map((t) => JSON.parse(t)).find((d) => d["@type"] === "Product");
    expect(product.offers.priceCurrency).toBe("KES");
    expect(product.offers.availability).toMatch(/InStock|SoldOut/);
    const canonical = await page.locator('link[rel="canonical"]').getAttribute("href");
    expect(new URL(canonical!).pathname).toBe(new URL(page.url()).pathname);
    await expectAccessible(page);
    await page
      .getByRole("link", { name: /Electronics|Phones|Wanjiku|Kiprop|Zawadi|Amina|Baraka/ })
      .last()
      .click();
    await expect(page).toHaveURL(/\/s\/[a-z0-9-]+$/);
    await expect(page.getByRole("heading", { level: 2, name: /Listings \(\d+\)/ })).toBeVisible();
  });

  test("missing listings 404 and old slugs redirect to the canonical address", async ({ page, request }) => {
    expect((await request.get("/l/not-a-real-listing-cm0000000000000000000000a")).status()).toBe(404);
    expect((await request.get("/c/no-such-category")).status()).toBe(404);
    expect((await request.get("/s/no-such-shop")).status()).toBe(404);

    await page.goto("/c/phones-tablets");
    const href = await page
      .getByRole("region", { name: "Results" })
      .getByRole("article")
      .first()
      .getByRole("link")
      .getAttribute("href");
    const id = href!.split("-").at(-1)!;
    const redirect = await request.get(`/l/old-title-${id}`, { maxRedirects: 0 });
    expect(redirect.status()).toBe(308);
    expect(redirect.headers()["location"]).toBe(href);
  });

  test("buyers can save items; guests are asked to sign in", async ({ page }) => {
    await page.goto("/c/fashion");
    const card = page.getByRole("region", { name: "Results" }).getByRole("article").first();
    const name = await card.getByRole("link").innerText();
    await card.getByRole("button", { name: `Save ${name}` }).click();
    await page.waitForURL(/\/sign-in/);

    await signInAs(page, seeded.buyer, "/c/fashion");
    const save = page.getByRole("button", { name: `Save ${name}` });
    await save.click();
    await expect(page.getByRole("button", { name: `Remove ${name} from saved items` })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await page.goto("/account/saved");
    await expect(page.getByRole("link", { name })).toBeVisible();
    await expectAccessible(page);
    await page.getByRole("button", { name: `Remove ${name} from saved items` }).click();
    await page.reload();
    await expect(page.getByText("Nothing saved yet").first()).toBeVisible();
  });

  test("sitemap and robots are set up for search engines", async ({ request }) => {
    const sitemap = await (await request.get("/sitemap.xml")).text();
    expect(sitemap).toContain("/c/phones-tablets</loc>");
    expect(sitemap).toMatch(/\/l\/[a-z0-9-]+-[a-z0-9]+<\/loc>/);
    const robots = await (await request.get("/robots.txt")).text();
    expect(robots).toContain("Disallow: /account");
    expect(robots).toContain("Disallow: /sell");
    expect(robots).toContain("Sitemap:");
  });
});
