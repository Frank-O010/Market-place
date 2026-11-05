import sharp from "sharp";
import type { Browser, Page } from "@playwright/test";
import { expect, signInAs, signUp, test } from "./helpers";
import { addListingToCart, randomPhone } from "./shop";

const SELLER = { user: "Wanjiku Mwangi", shop: "/s/wanjiku-electronics", name: "Wanjiku" };
const BUYERS = 4;

async function newBuyer(browser: Browser, baseURL: string, name: string): Promise<Page> {
  const context = await browser.newContext({
    baseURL,
    extraHTTPHeaders: {
      "x-forwarded-for": `10.9.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`,
    },
  });
  await context.addCookies([{ name: "mp_consent", value: "essential", url: baseURL }]);
  const page = await context.newPage();
  await signUp(page, name);
  return page;
}

// Several people pressing "Pay" for the last one at the same moment: exactly one gets it.
test("the last item can't be sold twice when buyers check out at the same time", async ({
  page,
  browser,
  baseURL,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "One run is enough: it checks the database, not the layout.");
  test.setTimeout(120_000);
  const title = `Last-one charger ${Date.now().toString().slice(-6)}`;

  // The seller lists a single unit.
  await signInAs(page, SELLER.user, "/sell/listings/new");
  await page.getByLabel("Title").fill(title);
  await page.getByLabel("Category").selectOption({ label: "Accessories" });
  await page.getByLabel("Price (KES)").first().fill("1,500");
  await page.getByLabel("How many do you have?").fill("1");
  await page.getByLabel("Condition").selectOption("NEW");
  await page.getByLabel("Description").fill("A fast USB-C phone charger, boxed and unused. Only one available.");
  await page.getByRole("button", { name: "Save and add photos" }).click();
  await page.waitForURL(/step=photos/);
  const buffer = await sharp({ create: { width: 800, height: 600, channels: 3, background: "#334155" } })
    .jpeg()
    .toBuffer();
  await page.getByLabel("Choose photos to upload").setInputFiles({ name: "c.jpg", mimeType: "image/jpeg", buffer });
  await expect(page.getByRole("list", { name: "Listing photos" }).getByRole("listitem")).toHaveCount(1);
  await page.getByRole("button", { name: "Publish" }).click();
  await expect(page.getByText("Active", { exact: true }).filter({ visible: true })).toBeVisible();

  // Every buyer gets it into their cart and onto the payment step.
  const buyers = await Promise.all(
    Array.from({ length: BUYERS }, (_, i) => newBuyer(browser, baseURL!, `Racer ${i} ${Date.now()}`)),
  );
  for (const buyer of buyers) {
    await addListingToCart(buyer, SELLER.shop, title);
    await buyer.goto("/cart");
    await buyer.getByRole("link", { name: new RegExp(`Check out with ${SELLER.name}`) }).click();
    await buyer.waitForURL(/\/checkout\?seller=/);
    await buyer.getByLabel("Phone number").fill(randomPhone());
  }

  // Everyone presses Pay at once.
  const outcomes = await Promise.all(
    buyers.map(async (buyer) => {
      await buyer.getByRole("button", { name: /with M-Pesa/ }).click();
      return Promise.race([
        buyer.waitForURL(/\/account\/orders\/[a-z0-9]+/, { timeout: 20_000 }).then(() => "ordered" as const),
        buyer
          .getByText(/Not enough of|no longer for sale/)
          .first()
          .waitFor({ timeout: 20_000 })
          .then(() => "refused" as const),
      ]);
    }),
  );
  expect(outcomes.filter((o) => o === "ordered")).toHaveLength(1);
  expect(outcomes.filter((o) => o === "refused")).toHaveLength(BUYERS - 1);

  // And the listing now shows as sold out.
  await page.goto(SELLER.shop);
  await page.getByRole("link", { name: title }).first().click();
  await expect(page.getByRole("button", { name: "Add to cart" })).toHaveCount(0);
  await Promise.all(buyers.map((b) => b.context().close()));
});
