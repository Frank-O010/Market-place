import type { Page } from "@playwright/test";
import { expect } from "./helpers";

/** Streaming can briefly leave a hidden copy of the page in the DOM; only look at the visible one. */
export const byTestId = (page: Page, id: string) => page.getByTestId(id).filter({ visible: true });
export const orderStatus = (page: Page) => byTestId(page, "order-status");

/** Opens a listing from a shop page by its title and adds it to the cart. */
export async function addListingToCart(page: Page, shopPath: string, title: string) {
  await page.goto(shopPath);
  await page.getByRole("article").first().waitFor();
  await page.getByRole("link", { name: title }).first().click();
  await page.getByRole("heading", { level: 1, name: title }).waitFor();
  await page.getByRole("button", { name: "Add to cart" }).click();
  await expect(page.getByRole("link", { name: "Go to cart" })).toBeVisible();
}

/** A random Safaricom-style number, for accounts created during a test. */
export const randomPhone = () => `07${Math.floor(10_000_000 + Math.random() * 89_999_999)}`;

/** Checks out the cart group for `sellerName` with M-Pesa pickup and approves it in the sandbox. Returns the order path. */
export async function checkoutAndPay(page: Page, sellerName: string, phone: string) {
  await page.goto("/cart");
  await page.getByRole("link", { name: new RegExp(`Check out with ${sellerName}`) }).click();
  await page.waitForURL(/\/checkout\?seller=/);
  // Each buyer pays from their own number: one number shared by several accounts is a fraud signal.
  await page.getByLabel("Phone number").fill(phone);
  await page.getByRole("button", { name: /with M-Pesa/ }).click();
  await page.waitForURL(/\/account\/orders\/[a-z0-9]+/);
  const orderPath = new URL(page.url()).pathname;
  await page.getByRole("link", { name: "Test mode: open the payment sandbox" }).click();
  await page.getByRole("button", { name: "Approve payment" }).click();
  await page.waitForURL(`**${orderPath}`);
  await expect(orderStatus(page)).toHaveText("Paid, money held safely");
  return orderPath;
}

export async function markShipped(page: Page, orderId: string) {
  await page.goto(`/sell/orders/${orderId}`);
  await page.getByRole("button", { name: "Mark as shipped" }).click();
  await expect(orderStatus(page)).toHaveText("On the way");
}
