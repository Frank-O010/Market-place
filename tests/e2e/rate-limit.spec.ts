import { expect, test } from "./helpers";

test("sign-up is rate limited per client", async ({ page }) => {
  // The sign-up policy allows 5 attempts per 10 minutes from one IP.
  for (let i = 0; i < 6; i++) {
    await page.goto("/dev/sign-in");
    await page.getByLabel("Full name").fill(`Rate Limit ${i}`);
    await page.getByLabel("Email").fill(`rate.${Date.now()}.${i}@soko.test`);
    await page.getByRole("button", { name: "Create account" }).click();
    if (i < 5) {
      await page.waitForURL((url) => url.pathname === "/");
      await page.context().clearCookies();
    }
  }
  await expect(page.getByText("Too many attempts")).toBeVisible();
});
