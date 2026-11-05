import AxeBuilder from "@axe-core/playwright";
import { test as base, expect, type Page } from "@playwright/test";

/**
 * Each test gets its own client IP so the per-IP sign-in and sign-up rate limits
 * don't leak between tests. (The rate limits themselves are covered in rate-limit.spec.ts.)
 */
export const test = base.extend({
  page: async ({ page, baseURL }, provide) => {
    const ip = `10.${rand()}.${rand()}.${rand()}`;
    await page.setExtraHTTPHeaders({ "x-forwarded-for": ip });
    // The cookie banner is fixed to the bottom of the screen; answer it up front so it doesn't
    // cover buttons. (admin.spec.ts tests the banner itself with a fresh context.)
    await page.context().addCookies([{ name: "mp_consent", value: "essential", url: baseURL! }]);
    await provide(page);
  },
});
const rand = () => Math.floor(Math.random() * 254) + 1;
export { expect };

export const seeded = {
  admin: "Achieng Admin",
  moderator: "Kamau Moderator",
  buyer: "Njeri Buyer",
  seller: "Wanjiku Mwangi",
  suspended: "Suspended User",
} as const;

export async function signInAs(page: Page, name: string, redirectTo = "/") {
  await page.goto(`/dev/sign-in?redirect_url=${encodeURIComponent(redirectTo)}`);
  await page.getByRole("button", { name: `Sign in as ${name}` }).click();
  await page.waitForURL((url) => url.pathname + url.search === redirectTo || url.pathname === redirectTo);
}

export async function signUp(page: Page, name: string) {
  const email = `${name.toLowerCase().replace(/\W+/g, ".")}.${Date.now()}@soko.test`;
  await page.goto("/dev/sign-in?redirect_url=/account");
  await page.getByLabel("Full name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL((url) => url.pathname === "/account");
  return email;
}

/** Fails the test on any WCAG 2.2 A/AA violation. */
export async function expectAccessible(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  const summary = results.violations.map(
    (v) =>
      `${v.id}: ${v.help} (${v.nodes.length} nodes) ${v.nodes
        .map((n) => n.target.join(" "))
        .slice(0, 3)
        .join(", ")}`,
  );
  expect(summary, "accessibility violations").toEqual([]);
}
