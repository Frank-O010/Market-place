import sharp from "sharp";
import { expect, expectAccessible, seeded, signInAs, signUp, test } from "./helpers";
import { addListingToCart, byTestId, checkoutAndPay, markShipped, orderStatus, randomPhone } from "./shop";

const BARAKA = { user: "Baraka Ochieng", shop: "/s/baraka-home-furnishings", name: "Baraka Home Furnishings" };
const KIPROP = { user: "Kiprop Kirui", shop: "/s/kiprop-sports", name: "Kiprop Sports" };
const WANJIKU = { user: "Wanjiku Mwangi", shop: "/s/wanjiku-electronics", name: "Wanjiku Electronics" };
const BUYER2 = "Otieno Buyer";
const BUYER2_PHONE = "0733 111 222";

async function jpeg(colour: string) {
  const buffer = await sharp({ create: { width: 800, height: 600, channels: 3, background: colour } })
    .jpeg()
    .toBuffer();
  return { name: "photo.jpg", mimeType: "image/jpeg", buffer };
}

test("buyers and sellers message each other, and sharing a phone number first shows a warning", async ({
  page,
}, testInfo) => {
  const stamp = `${testInfo.project.name}-${Date.now().toString().slice(-6)}`;
  await signInAs(page, seeded.buyer, BARAKA.shop);
  await page.getByRole("link", { name: "Handwoven sisal rug, 5x7" }).first().click();
  await page.getByRole("button", { name: "Message seller" }).click();
  await page.waitForURL(/\/messages\/[a-z0-9]+$/);
  const conversationPath = new URL(page.url()).pathname;
  await expect(page.getByRole("heading", { level: 1, name: BARAKA.name })).toBeVisible();

  await page.getByLabel("Your message").fill(`Is the rug still available? (${stamp})`);
  await page.getByRole("button", { name: "Send" }).click();
  const messages = byTestId(page, "message-list");
  await expect(messages.getByText(`Is the rug still available? (${stamp})`)).toBeVisible();

  // Contact details before an order: warn, and only send if the buyer insists.
  await page.getByLabel("Your message").fill(`Call me on 0712 345 678 (${stamp})`);
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByRole("alert").filter({ hasText: /payment isn't protected/ })).toBeVisible();
  await expectAccessible(page);
  await page.getByRole("button", { name: "Send anyway" }).click();
  await expect(messages.getByText(`Call me on 0712 345 678 (${stamp})`)).toBeVisible();

  // The seller is notified and sees the safety note on the flagged message.
  await signInAs(page, BARAKA.user, "/");
  await expect(page.getByRole("link", { name: /Notifications, \d+ unread/ })).toBeVisible();
  await page.goto("/notifications");
  await expect(page.getByRole("link", { name: /New message from Njeri Buyer/ }).first()).toBeVisible();
  await expectAccessible(page);
  await page.goto("/messages");
  await page
    .getByRole("link", { name: /Njeri Buyer/ })
    .filter({ visible: true })
    .first()
    .click();
  await page.waitForURL(`**${conversationPath}`);
  await expect(byTestId(page, "message-list").getByText(`Call me on 0712 345 678 (${stamp})`)).toBeVisible();
  await expect(page.getByText(/Contains contact details/).last()).toBeVisible();
  await page.getByLabel("Your message").fill(`Yes it is! (${stamp})`);
  await page.getByRole("button", { name: "Send" }).click();
  await expect(byTestId(page, "message-list").getByText(`Yes it is! (${stamp})`)).toBeVisible();

  // The buyer sees the reply; another user can't open the conversation.
  await signInAs(page, seeded.buyer, conversationPath);
  await expect(page.getByText(`Yes it is! (${stamp})`)).toBeVisible();
  await signInAs(page, BUYER2, "/");
  await page.goto(conversationPath);
  await expect(page.getByText("We couldn't find that page")).toBeVisible();
});

test("after a completed order the buyer reviews the seller and the seller replies publicly", async ({
  page,
}, testInfo) => {
  const stamp = `${testInfo.project.name}-${Date.now().toString().slice(-6)}`;
  await signInAs(page, BUYER2, "/");
  await addListingToCart(page, KIPROP.shop, "Yoga mat, 6mm");
  const orderPath = await checkoutAndPay(page, KIPROP.name, BUYER2_PHONE);
  const orderId = orderPath.split("/").at(-1)!;
  // No reviews before the order is complete.
  await expect(page.getByRole("heading", { name: `Review ${KIPROP.name}` })).toHaveCount(0);

  await signInAs(page, KIPROP.user, "/");
  await markShipped(page, orderId);

  await signInAs(page, BUYER2, orderPath);
  await page.getByRole("button", { name: "I received it" }).click();
  await page.getByRole("button", { name: "Yes, release payment" }).click();
  await expect(orderStatus(page)).toHaveText("Completed");
  await page.getByRole("button", { name: "Post review" }).click();
  await expect(page.getByText("Choose a rating").first()).toBeVisible();
  await page.getByRole("radio", { name: "5 stars, Excellent" }).check();
  await page.getByLabel(/Tell other buyers/).fill(`Great mat, quick handover. ${stamp}`);
  await expectAccessible(page);
  await page.getByRole("button", { name: "Post review" }).click();
  await expect(page.getByRole("heading", { name: "Your review" })).toBeVisible();

  await signInAs(page, KIPROP.user, `/sell/orders/${orderId}`);
  await page.getByLabel("Reply publicly").fill(`Thank you, enjoy your workouts! ${stamp}`);
  await page.getByRole("button", { name: "Post reply" }).click();
  await expect(page.getByText(`Thank you, enjoy your workouts! ${stamp}`)).toBeVisible();

  await page.goto(KIPROP.shop);
  const reviews = byTestId(page, "review-list");
  await expect(reviews.getByText(`Great mat, quick handover. ${stamp}`)).toBeVisible();
  await expect(reviews.getByText(`Thank you, enjoy your workouts! ${stamp}`)).toBeVisible();
  await expect(reviews.getByText(/Otieno, verified purchase of Yoga mat/).first()).toBeVisible();
});

test("a buyer reports a problem with a photo, the seller replies, and a moderator issues a partial refund", async ({
  page,
}) => {
  await signInAs(page, BUYER2, "/");
  await addListingToCart(page, BARAKA.shop, "4x6 metal bed frame");
  const orderPath = await checkoutAndPay(page, BARAKA.name, BUYER2_PHONE);
  const orderId = orderPath.split("/").at(-1)!;
  const number = (await page.getByRole("heading", { level: 1 }).innerText()).replace("Order ", "").trim();
  await signInAs(page, BARAKA.user, "/");
  await markShipped(page, orderId);

  await signInAs(page, BUYER2, orderPath);
  await page.getByRole("button", { name: "Report a problem" }).click();
  await page.getByRole("button", { name: "Report problem" }).click();
  await expect(page.getByText("Choose what went wrong")).toBeVisible();
  await page.getByText("The item arrived damaged or doesn't work").click();
  await page.getByLabel("What happened?").fill("One of the side rails is bent and the bolts don't fit.");
  await page.getByLabel(/Photos/).setInputFiles(await jpeg("#884422"));
  await expectAccessible(page);
  await page.getByRole("button", { name: "Report problem" }).click();
  await expect(orderStatus(page)).toHaveText("In dispute");
  const panel = byTestId(page, "dispute-panel");
  await expect(panel.getByText("Waiting for the seller")).toBeVisible();
  const photoSrc = await panel.getByRole("img", { name: "Photo 1 from the buyer" }).getAttribute("src");
  expect((await page.request.get(photoSrc!)).status()).toBe(200);

  // Someone else can't see the evidence.
  await signInAs(page, seeded.buyer, "/");
  expect((await page.request.get(photoSrc!)).status()).toBe(404);

  await signInAs(page, BARAKA.user, `/sell/orders/${orderId}`);
  await page.getByLabel("Your side").fill("It was fine when it left. Happy to send replacement bolts.");
  await page.getByRole("button", { name: "Send reply" }).click();
  await expect(byTestId(page, "dispute-panel").getByText("Our team is reviewing")).toBeVisible();

  await signInAs(page, seeded.moderator, "/admin/moderation?tab=disputes");
  await byTestId(page, "dispute-queue")
    .getByRole("link", { name: new RegExp(`Order ${number}`) })
    .click();
  await expect(page.getByText("One of the side rails is bent").first()).toBeVisible();
  await expectAccessible(page);
  await page.getByText("Partial refund, the rest to the seller").click();
  await page.getByLabel("Refund amount (KES)").fill("2000");
  await page.getByLabel("Explanation for both sides").fill("Bent rail confirmed by photo; partial refund for repair.");
  await page.getByRole("button", { name: "Resolve dispute" }).click();
  await expect(orderStatus(page)).toHaveText("Completed");

  await signInAs(page, BUYER2, orderPath);
  await expect(byTestId(page, "dispute-panel").getByText(/refunded Ksh.2,000/)).toBeVisible();
  await signInAs(page, BARAKA.user, `/sell/orders/${orderId}`);
  // The payout is the seller's share minus the refund.
  await expect(byTestId(page, "payout-status")).toContainText("Ksh");
  const payoutText = await byTestId(page, "payout-status").innerText();
  const payout = Number(payoutText.split(":")[0]!.replace(/[^\d.]/g, ""));
  const sellerShare = Number((await byTestId(page, "order-payout").innerText()).replace(/[^\d.]/g, ""));
  expect(payout).toBe(sellerShare - 2000);
});

test("reported listings reach the moderation queue", async ({ page }, testInfo) => {
  const stamp = `${testInfo.project.name}-${Date.now().toString().slice(-6)}`;
  await signInAs(page, seeded.buyer, "/s/zawadi-kids-beauty");
  await page.getByRole("link", { name: "Oud perfume oil, 12ml" }).first().click();
  await page.getByRole("button", { name: "Report this listing" }).click();
  await page.getByRole("button", { name: "Send report" }).click();
  await expect(page.getByText("Choose a reason").first()).toBeVisible();
  await page.getByText("Counterfeit or fake").click();
  await page.getByLabel("Anything else? (optional)").fill(`Looks like a copy of a brand. ${stamp}`);
  await expectAccessible(page);
  await page.getByRole("button", { name: "Send report" }).click();
  await expect(page.getByText("Thanks. Our team will take a look.")).toBeVisible();

  // Ordinary users can't open the queue.
  await page.goto("/admin/moderation");
  await expect(page.getByText("We couldn't find that page")).toBeVisible();

  await signInAs(page, seeded.moderator, "/admin/moderation?tab=reports");
  // One card per reported listing (a report from an earlier run may already be there).
  const card = byTestId(page, "report-queue").locator(":scope > li").filter({ hasText: "Oud perfume oil, 12ml" });
  await expect(card).toBeVisible();
  await expectAccessible(page);
  await card.getByRole("button", { name: "Dismiss" }).click();
  await expect(card).toHaveCount(0);
});

test("a new account's high-value order is flagged and the seller's payout waits for review", async ({
  page,
}, testInfo) => {
  await signUp(page, `Newbuyer ${testInfo.project.name}`);
  await addListingToCart(page, WANJIKU.shop, "Tecno Camon 20 Pro 256GB");
  const orderPath = await checkoutAndPay(page, WANJIKU.name, randomPhone());
  const orderId = orderPath.split("/").at(-1)!;
  const number = (await page.getByRole("heading", { level: 1 }).innerText()).replace("Order ", "").trim();

  await signInAs(page, WANJIKU.user, `/sell/orders/${orderId}`);
  await expect(page.getByText(/routine safety check/)).toBeVisible();

  await signInAs(page, seeded.moderator, "/admin/moderation?tab=orders");
  const flagged = byTestId(page, "flagged-orders").getByRole("listitem").filter({ hasText: number });
  await expect(flagged).toContainText("New account placing a high-value order");
  await expectAccessible(page);
  await flagged.getByRole("button", { name: "Looks fine: release hold" }).click();
  await expect(flagged).toHaveCount(0);
});

test("a seller sends their ID and a moderator verifies them", async ({ page, browser }, testInfo) => {
  const stamp = `${testInfo.project.name}${Date.now().toString().slice(-6)}`;
  await signUp(page, `Idseller ${stamp}`);
  await page.goto("/sell/onboarding");
  await page.getByLabel("Shop name").fill(`ID Shop ${stamp}`);
  await page.getByLabel("Where you sell from").selectOption("Kilimani");
  await page.getByRole("button", { name: "Create my shop" }).click();
  await page.waitForURL("**/sell?welcome=1");

  await page.getByRole("link", { name: "Get verified" }).click();
  await expect(byTestId(page, "verification-tier")).toContainText("Not verified yet");
  await page.getByLabel("Photo of your national ID or passport").setInputFiles(await jpeg("#336699"));
  await page.getByRole("button", { name: "Send for checking" }).click();
  await expect(page.getByText("Tick the box to continue")).toBeVisible();
  await page.getByText(/may view this photo to verify my identity/).click();
  await page.getByLabel("Photo of your national ID or passport").setInputFiles(await jpeg("#336699"));
  await expectAccessible(page);
  await page.getByRole("button", { name: "Send for checking" }).click();
  await expect(page.getByText(/We're checking your ID/)).toBeVisible();

  const modContext = await browser.newContext(testInfo.project.use);
  const moderator = await modContext.newPage();
  await signInAs(moderator, seeded.moderator, "/admin/moderation?tab=verification");
  const card = byTestId(moderator, "verification-queue")
    .getByRole("listitem")
    .filter({ hasText: `ID Shop ${stamp}` });
  const photoHref = await card.getByRole("link", { name: /Open ID photo/ }).getAttribute("href");
  expect((await moderator.request.get(photoHref!)).status()).toBe(200);
  // The seller themselves (and anyone else) can't fetch the ID photo.
  expect((await page.request.get(photoHref!)).status()).toBe(404);
  await card.getByRole("button", { name: "Approve ID" }).click();
  await expect(card).toHaveCount(0);
  await modContext.close();

  await page.reload();
  await expect(byTestId(page, "verification-tier")).toContainText("Verified (ID checked)");
});
