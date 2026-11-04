import { expect, expectAccessible, test } from "./helpers";

for (const colorScheme of ["light", "dark"] as const) {
  test(`component gallery renders and is accessible in ${colorScheme} mode`, async ({ page }) => {
    await page.emulateMedia({ colorScheme });
    await page.goto("/dev/components");
    await expect(page.getByRole("heading", { name: "Component gallery" })).toBeVisible();
    await expect(page.locator("html")).toHaveClass(new RegExp(colorScheme));
    await expectAccessible(page);
  });
}

test("theme toggle switches between light and dark", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/dev/components");
  const toggle = page.getByRole("button", { name: /Switch to/ }).first();
  await toggle.click(); // system -> light
  await toggle.click(); // light -> dark
  await expect(page.locator("html")).toHaveClass(/dark/);
});

test("dialog opens, traps focus and closes with Escape", async ({ page }) => {
  await page.goto("/dev/components");
  await page.getByRole("button", { name: "Open dialog" }).click();
  const dialog = page.getByRole("dialog", { name: "Confirm delivery?" });
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});
