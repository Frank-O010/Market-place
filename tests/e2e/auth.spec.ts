import { expect, expectAccessible, seeded, signInAs, signUp, test } from "./helpers";

test.describe("sign up and sign in", () => {
  test("a new visitor can create an account and starts as a buyer", async ({ page }) => {
    await signUp(page, "Test Buyer");
    await expect(page.getByRole("heading", { name: "Test Buyer" })).toBeVisible();
    await expect(page.getByTestId("account-roles")).toHaveText("buyer");
  });

  test("sign-up validates input and shows field errors", async ({ page }) => {
    await page.goto("/dev/sign-in");
    await page.getByLabel("Full name").fill("A");
    await page.getByLabel("Email").fill("not-an-email");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByText("Enter your name")).toBeVisible();
    await expect(page.getByText("Enter a valid email address")).toBeVisible();
    await expectAccessible(page);
  });

  test("signed-out visitors are sent to sign in and back afterwards", async ({ page }) => {
    await page.goto("/account");
    await page.waitForURL(
      (url) => url.pathname === "/dev/sign-in" && url.searchParams.get("redirect_url") === "/account",
    );
    await page.getByRole("button", { name: `Sign in as ${seeded.buyer}` }).click();
    await page.waitForURL((url) => url.pathname === "/account");
    await expect(page.getByRole("heading", { name: seeded.buyer })).toBeVisible();
  });

  test("signing out ends the session", async ({ page }) => {
    await signInAs(page, seeded.buyer);
    await page.getByRole("button", { name: `Account menu for ${seeded.buyer}` }).click();
    await page.getByRole("button", { name: "Sign out" }).click();
    await page.waitForURL((url) => url.pathname === "/");
    await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
  });

  test("suspended users are told their account is suspended", async ({ page }) => {
    await signInAs(page, seeded.suspended);
    await page.getByRole("button", { name: `Account menu for ${seeded.suspended}` }).click();
    await expect(page.getByRole("alert")).toContainText("suspended");
  });
});

test.describe("roles", () => {
  test("buyers cannot see the admin area", async ({ page }) => {
    await signInAs(page, seeded.buyer);
    const response = await page.goto("/admin");
    await expect(page.getByText("We couldn't find that page")).toBeVisible();
    expect(response?.status()).toBeLessThan(500);
  });

  test("admins and moderators can see the admin area", async ({ page }) => {
    await signInAs(page, seeded.admin, "/admin");
    await expect(page.getByTestId("admin-stats")).toContainText("Active listings");
    await signInAs(page, seeded.moderator, "/admin");
    await expect(page.getByTestId("admin-stats")).toBeVisible();
  });

  test("sellers see only their own listing counts", async ({ page }) => {
    await signInAs(page, seeded.seller, "/sell");
    // Wanjiku Electronics has 11 active listings in the seed; other sellers' listings are not counted.
    await expect(page.getByTestId("seller-stats")).toContainText("Active listings11");
  });

  test("role switching updates what a user can access", async ({ page }) => {
    await signUp(page, "Role Switcher");
    await page.goto("/sell");
    await expect(page.getByText("Open your shop")).toBeVisible();

    await page.goto("/dev/roles");
    await page.getByRole("button", { name: /seller role/ }).click();
    await expect(page.getByRole("button", { name: /seller role/ })).toHaveAttribute("aria-pressed", "true");
    await page.goto("/sell");
    await expect(page.getByTestId("seller-stats")).toContainText("Active listings0");

    await page.goto("/admin");
    await expect(page.getByText("We couldn't find that page")).toBeVisible();
    await page.goto("/dev/roles");
    await page.getByRole("button", { name: /admin role/ }).click();
    await expect(page.getByRole("button", { name: /admin role/ })).toHaveAttribute("aria-pressed", "true");
    await page.goto("/admin");
    await expect(page.getByTestId("admin-stats")).toBeVisible();

    await page.goto("/account");
    await expect(page.getByTestId("account-roles")).toHaveText(/buyer.*seller.*admin/);
  });
});
