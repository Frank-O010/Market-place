import { expect, expectAccessible, seeded, signInAs, signUp, test } from "./helpers";

const NOT_FOUND = "We couldn't find that page";

test.describe("admin area", () => {
  test("is hidden from buyers, and admin-only pages are hidden from moderators", async ({ page }) => {
    await signInAs(page, seeded.buyer, "/");
    for (const path of ["/admin", "/admin/users", "/admin/settings", "/admin/audit"]) {
      await page.goto(path);
      await expect(page.getByText(NOT_FOUND)).toBeVisible();
    }

    await signInAs(page, seeded.moderator, "/admin");
    await expect(page.getByTestId("admin-stats").filter({ visible: true })).toBeVisible();
    const nav = page.getByRole("navigation", { name: "Admin" }).filter({ visible: true });
    await expect(nav.getByRole("link", { name: "Users" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Settings" })).toHaveCount(0);
    for (const path of ["/admin/settings", "/admin/audit", "/admin/payouts", "/admin/categories"]) {
      await page.goto(path);
      await expect(page.getByText(NOT_FOUND)).toBeVisible();
    }
  });

  test("an admin sees the overview and every admin page passes an accessibility check", async ({ page }) => {
    await signInAs(page, seeded.admin, "/admin?days=90");
    await expect(page.getByText("Sales (GMV)")).toBeVisible();
    await expect(page.getByRole("link", { name: "Last 90 days" })).toHaveAttribute("aria-current", "page");
    await expectAccessible(page);
    for (const [path, heading] of [
      ["/admin/users", "Users"],
      ["/admin/listings", "Listings"],
      ["/admin/orders", "Orders"],
      ["/admin/payouts", "Payouts"],
      ["/admin/categories", "Categories"],
      ["/admin/settings", "Settings"],
      ["/admin/audit", "Audit log"],
    ] as const) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
      await page.getByRole("navigation", { name: "Admin" }).filter({ visible: true }).waitFor();
      await expectAccessible(page);
    }
  });

  test("changing a setting is saved and written to the audit log", async ({ page }) => {
    await signInAs(page, seeded.admin, "/admin/settings");
    const days = page.getByLabel("Days before payment is released automatically");
    const before = await days.inputValue();
    const after = String((Number(before) % 30) + 1);
    await days.fill(after);
    await page.getByRole("button", { name: "Save settings" }).click();
    await expect(page.getByText("Settings saved")).toBeVisible();
    await page.reload();
    await expect(page.getByLabel("Days before payment is released automatically")).toHaveValue(after);

    await page.goto("/admin/audit?action=settings.auto_release_days");
    const row = page.getByTestId("audit-log").getByRole("row").nth(1);
    await expect(row).toContainText("settings.auto_release_days");
    await expect(row).toContainText(seeded.admin);
    await expect(row).toContainText(`"from":"${before}"`);
    await expect(row).toContainText(`"to":"${after}"`);

    // Put it back for the other tests.
    await page.goto("/admin/settings");
    await page.getByLabel("Days before payment is released automatically").fill(before);
    await page.getByRole("button", { name: "Save settings" }).click();
    await expect(page.getByText("Settings saved")).toBeVisible();
  });

  test("settings are validated", async ({ page }) => {
    await signInAs(page, seeded.admin, "/admin/settings");
    await page.getByLabel("Commission (%)").fill("80");
    await page.getByRole("button", { name: "Save settings" }).click();
    await expect(page.getByText("Enter a percentage between 0 and 50, like 10 or 7.5")).toBeVisible();
  });

  test("an admin can make someone a moderator, but can't remove their own admin role", async ({ page }) => {
    const name = `Promoted Person ${Date.now()}`;
    const email = await signUp(page, name);

    await signInAs(page, seeded.admin, "/admin/users");
    await page.getByLabel("Name, email, phone or shop").fill(email);
    await page.getByRole("button", { name: "Search" }).click();
    await page.getByRole("link", { name }).click();
    await page.getByRole("checkbox", { name: /^Moderator/ }).check();
    await page.getByRole("button", { name: "Save roles" }).click();
    await expect(page.getByText("Roles updated")).toBeVisible();
    await expect(page.getByTestId("user-roles").filter({ visible: true })).toHaveText("Buyer, Moderator");

    await page.goto(`/admin/audit?action=user.roles.change`);
    await expect(page.getByTestId("audit-log").getByRole("row").nth(1)).toContainText("BUYER,MODERATOR");

    // Their own page: unticking Admin is refused.
    await page.goto("/admin/users?role=ADMIN");
    await page.getByRole("link", { name: seeded.admin }).click();
    await page.getByRole("checkbox", { name: /^Admin/ }).uncheck();
    await page.getByRole("button", { name: "Save roles" }).click();
    await expect(page.getByText("You can't remove your own admin role. Ask another admin.")).toBeVisible();
  });

  test("an admin can add, rename and delete a category", async ({ page }) => {
    const name = `Test category ${Date.now()}`;
    await signInAs(page, seeded.admin, "/admin/categories");
    const add = page.getByRole("region", { name: "Add a category" });
    await add.getByLabel("Name").fill(name);
    await add.getByRole("button", { name: "Add category" }).click();
    await expect(page.getByText("Category added")).toBeVisible();

    const item = page
      .getByTestId("admin-category")
      .filter({ has: page.locator(`input[name="name"][value="${name}"]`) });
    await expect(item).toHaveCount(1);
    page.once("dialog", (d) => d.accept());
    await item.getByRole("button", { name: `Delete ${name}` }).click();
    await expect(page.getByText("Deleted", { exact: true })).toBeVisible();
    await expect(item).toHaveCount(0);
  });

  test("staff can search orders and open one", async ({ page }) => {
    await signInAs(page, seeded.moderator, "/admin/orders");
    const first = page.getByTestId("admin-orders").getByRole("link").first();
    const number = (await first.innerText()).trim();
    await page.getByLabel(/Order number/).fill(number);
    await page.getByRole("button", { name: "Search" }).click();
    await expect(page.getByText("1 order", { exact: true }).filter({ visible: true })).toBeVisible();
    await page.getByRole("link", { name: number }).click();
    await expect(page.getByRole("heading", { name: `Order ${number}` })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Payments" })).toBeVisible();
  });
});

test.describe("privacy", () => {
  test("the cookie banner asks once and remembers the answer", async ({ browser, baseURL }) => {
    const context = await browser.newContext({ baseURL });
    const page = await context.newPage();
    await page.goto("/");
    const banner = page.getByTestId("consent-banner");
    await expect(banner).toBeVisible();
    await expectAccessible(page);
    await banner.getByRole("button", { name: "Essential only" }).click();
    await expect(banner).toBeHidden();
    await page.reload();
    await page.getByRole("main").waitFor();
    await expect(page.getByTestId("consent-banner")).toBeHidden();
    // Without consent, analytics events are refused.
    const event = await page.request.post("/api/analytics", { data: { event: "listing_viewed", properties: {} } });
    expect(event.status()).toBe(204);
    await context.close();
  });

  test("people can download their data and delete their account", async ({ page }) => {
    const email = await signUp(page, "Leaving Person");
    await page.goto("/account/privacy");
    await expect(page.getByRole("heading", { name: "Privacy and your data" })).toBeVisible();
    await expectAccessible(page);

    const exported = await page.request.get("/api/account/export");
    expect(exported.status()).toBe(200);
    expect(exported.headers()["content-disposition"]).toContain("attachment");
    const data = await exported.json();
    expect(JSON.stringify(data)).toContain(email);

    const remove = page.getByRole("button", { name: "Delete my account" });
    await expect(remove).toBeDisabled();
    await page.getByLabel("Type DELETE to confirm").fill("DELETE");
    await remove.click();
    await page.waitForURL(/account_deleted=1/);
    await page.goto("/account");
    await page.waitForURL(/\/sign-in/);

    // The account is gone from staff search too.
    await signInAs(page, seeded.admin, "/admin/users");
    await page.getByLabel("Name, email, phone or shop").fill(email);
    await page.getByRole("button", { name: "Search" }).click();
    await expect(page.getByText("Nobody matches that search.").filter({ visible: true })).toBeVisible();
  });

  test("an admin can't delete their own account from the privacy page", async ({ page }) => {
    await signInAs(page, seeded.admin, "/account/privacy");
    await page.getByLabel("Type DELETE to confirm").fill("DELETE");
    await page.getByRole("button", { name: "Delete my account" }).click();
    await expect(page.getByText("Admins can't delete their own account here. Ask another admin.")).toBeVisible();
  });
});
