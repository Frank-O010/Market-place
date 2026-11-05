import type { Page } from "@playwright/test";
import { expect, expectAccessible, seeded, signInAs, test } from "./helpers";

const SELLER = "Amina Hassan"; // runs Amina's Closet in the seed
const SHOP = "/s/amina-s-closet";

/**
 * Adds an in-stock item from Amina's shop to the cart and returns its title. Starts at `index`
 * so tests use different items, and skips anything an earlier test has sold out.
 */
async function addFirstItem(page: Page, index = 0) {
  await page.goto(SHOP);
  await page.getByRole("article").first().waitFor();
  const hrefs = await page
    .getByRole("article")
    .getByRole("link")
    .evaluateAll((links) => links.map((a) => a.getAttribute("href")!));
  for (const href of [...hrefs.slice(index), ...hrefs.slice(0, index)]) {
    await page.goto(href);
    await page.getByRole("heading", { level: 1 }).waitFor(); // the product streams in after the shell
    const add = page.getByRole("button", { name: "Add to cart" });
    if (!(await add.isVisible()) || (await add.isDisabled())) continue;
    const title = (await page.getByRole("heading", { level: 1 }).innerText()).trim();
    await add.click();
    await expect(page.getByRole("link", { name: "Go to cart" })).toBeVisible();
    return title;
  }
  throw new Error("No in-stock items left in the shop");
}

async function checkout(page: Page, method: "M-Pesa" | "card", delivery: "pickup" | "delivery" = "delivery") {
  await page.goto("/cart");
  await page.getByRole("link", { name: /Check out with Amina/ }).click();
  await page.waitForURL(/\/checkout\?seller=/);
  if (delivery === "delivery") {
    await page.getByLabel(/Delivery within Nairobi/).check();
    await page.getByLabel("Your area").selectOption("Kilimani");
    await page.getByLabel("Directions").fill("Kilimani Road, Blue Gate apartments, flat 4B");
  }
  await page.getByLabel("Phone number").fill("0712 345 678");
  if (method === "card") await page.getByLabel(/^Card/).check();
  await expectAccessible(page);
  await page.getByRole("button", { name: method === "card" ? /by card/ : /with M-Pesa/ }).click();
}

/** Streaming can briefly leave a hidden copy of the page in the DOM; only look at the visible one. */
const byTestId = (page: Page, id: string) => page.getByTestId(id).filter({ visible: true });
const status = (page: Page) => byTestId(page, "order-status");

const money = (text: string) => Number(text.replace(/[^\d.]/g, ""));

test.describe("buying", () => {
  test("an M-Pesa purchase moves through every order status and the seller is paid total minus commission", async ({
    page,
  }) => {
    await signInAs(page, seeded.buyer, "/");
    const title = await addFirstItem(page);
    await checkout(page, "M-Pesa");

    await page.waitForURL(/\/account\/orders\/[a-z0-9]+\?paying=mpesa/);
    await expect(status(page)).toHaveText("Waiting for payment");
    await expect(page.getByText("Check your phone.")).toBeVisible();
    const orderUrl = new URL(page.url()).pathname;
    const orderId = orderUrl.split("/").at(-1)!;
    const total = money(await byTestId(page, "order-total").innerText());
    await expectAccessible(page);

    // Approve in the sandbox: it sends a signed webhook, as Paystack would.
    await page.getByRole("link", { name: "Test mode: open the payment sandbox" }).click();
    await page.getByRole("button", { name: "Approve payment" }).click();
    await page.waitForURL(`**${orderUrl}`);
    await expect(status(page)).toHaveText("Paid, money held safely");

    // Receipt email and printable receipt.
    await page.goto("/dev/outbox");
    await expect(page.getByText(/Receipt for order SK-/).first()).toBeVisible();
    await page.goto(`${orderUrl}/receipt`);
    await expect(page.getByRole("heading", { name: "Receipt" })).toBeVisible();
    await expect(page.getByRole("cell", { name: title })).toBeVisible();
    await expectAccessible(page);

    // The seller ships it.
    await signInAs(page, SELLER, "/sell/orders");
    await expect(page.getByRole("link", { name: title }).first()).toBeVisible();
    await page.goto(`/sell/orders/${orderId}`);
    const commission = money(await byTestId(page, "order-commission").innerText());
    const payout = money(await byTestId(page, "order-payout").innerText());
    expect(payout).toBe(Math.round((total - commission) * 100) / 100);
    await page.getByLabel("Note for the buyer (optional)").fill("Rider Otieno, 0711 000 111");
    await page.getByRole("button", { name: "Mark as shipped" }).click();
    await expect(status(page)).toHaveText("On the way");
    await expectAccessible(page);

    // The buyer confirms delivery, which releases the money.
    await signInAs(page, seeded.buyer, orderUrl);
    await expect(page.getByText("Rider Otieno, 0711 000 111").first()).toBeVisible();
    await page.getByRole("button", { name: "I received it" }).click();
    await page.getByRole("button", { name: "Yes, release payment" }).click();
    await expect(status(page)).toHaveText("Completed");
    for (const step of ["Paid, money held safely", "On the way", "Delivered", "Completed"]) {
      await expect(page.getByRole("listitem").filter({ hasText: `${step} (done)` })).toBeVisible();
    }

    // The seller's payout went out for exactly total minus commission.
    await signInAs(page, SELLER, `/sell/orders/${orderId}`);
    await expect(async () => {
      await page.reload();
      await expect(byTestId(page, "payout-status")).toContainText("Paid", { timeout: 1000 });
    }).toPass({ timeout: 15_000 });
    expect(money((await byTestId(page, "payout-status").innerText()).split(":")[0]!)).toBe(payout);
    await page.goto("/sell/payouts");
    await expect(page.getByText("Paid", { exact: true }).first()).toBeVisible();
  });

  test("card payments go through the hosted checkout and come back to the order", async ({ page }) => {
    await signInAs(page, seeded.buyer, "/");
    await addFirstItem(page);
    await checkout(page, "card", "pickup");
    await page.waitForURL(/\/dev\/payments\//);
    await expect(page.getByText("by card")).toBeVisible();
    await page.getByRole("button", { name: "Approve payment" }).click();
    await page.waitForURL(/\/account\/orders\/[a-z0-9]+/);
    await expect(status(page)).toHaveText("Paid, money held safely");
  });

  test("a seller can cancel a paid order and the buyer is refunded", async ({ page }) => {
    await signInAs(page, seeded.buyer, "/");
    await addFirstItem(page, 1);
    await checkout(page, "M-Pesa", "pickup");
    await page.waitForURL(/\/account\/orders\//);
    const orderUrl = new URL(page.url()).pathname;
    const orderId = orderUrl.split("/").at(-1)!;
    await page.getByRole("link", { name: "Test mode: open the payment sandbox" }).click();
    await page.getByRole("button", { name: "Approve payment" }).click();
    await expect(status(page)).toHaveText("Paid, money held safely");

    await signInAs(page, SELLER, `/sell/orders/${orderId}`);
    await page.getByRole("button", { name: "Cancel this order" }).click();
    await page.getByLabel("Reason").fill("Sorry, it was damaged in storage");
    await page.getByRole("button", { name: "Cancel order" }).click();
    await expect(status(page)).toHaveText("Refunded");

    await signInAs(page, seeded.buyer, orderUrl);
    await expect(page.getByText(/Sorry, it was damaged in storage/).first()).toBeVisible();
    await page.goto("/dev/outbox");
    await expect(page.getByText(/was cancelled/).first()).toBeVisible();
  });

  test("a buyer can cancel before paying, and nobody else can see the order", async ({ page }) => {
    await signInAs(page, seeded.buyer, "/");
    await addFirstItem(page, 2);
    await checkout(page, "M-Pesa", "pickup");
    await page.waitForURL(/\/account\/orders\//);
    const orderUrl = new URL(page.url()).pathname;
    await page.getByRole("button", { name: "Cancel order" }).click();
    await expect(status(page)).toHaveText("Cancelled");

    await signInAs(page, "Otieno Buyer", "/");
    await page.goto(orderUrl);
    await expect(page.getByText("We couldn't find that page")).toBeVisible();
    await page.goto(`${orderUrl}/receipt`);
    await expect(page.getByText("We couldn't find that page")).toBeVisible();
  });

  test("checkout validates phone numbers and delivery details", async ({ page }) => {
    await signInAs(page, seeded.buyer, "/");
    await addFirstItem(page, 3);
    await page.goto("/cart");
    await page.getByRole("link", { name: /Check out with Amina/ }).click();
    await page.getByLabel(/Delivery within Nairobi/).check();
    await page.getByLabel("Phone number").fill("12345");
    await page.getByRole("button", { name: /with M-Pesa/ }).click();
    await expect(page.getByText("Enter a Kenyan mobile number, like 0712 345 678")).toBeVisible();
    await expect(page.locator("#area-error")).toHaveText("Choose your area");
    await expect(page.getByLabel("Phone number")).toHaveValue("12345");
  });
});

test("the payment webhook rejects unsigned or tampered requests", async ({ request }) => {
  const body = JSON.stringify({
    event: "charge.success",
    data: { reference: "SK-FAKE-1", amount: 100, currency: "KES" },
  });
  const unsigned = await request.post("/api/webhooks/paystack", {
    data: body,
    headers: { "content-type": "application/json" },
  });
  expect(unsigned.status()).toBe(401);
  const forged = await request.post("/api/webhooks/paystack", {
    data: body,
    headers: { "content-type": "application/json", "x-paystack-signature": "a".repeat(128) },
  });
  expect(forged.status()).toBe(401);
});

test("cron endpoints need the secret", async ({ request }) => {
  expect((await request.get("/api/cron/orders")).status()).toBe(401);
  expect((await request.get("/api/cron/search-reindex", { headers: { authorization: "Bearer wrong" } })).status()).toBe(
    401,
  );
});
