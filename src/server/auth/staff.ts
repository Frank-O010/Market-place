import "server-only";
import { notFound, redirect } from "next/navigation";
import { can } from "@/server/policy/can";
import { requireUserOrRedirect, type CurrentUser } from "./current-user";
import { hasTwoFactor } from "./identity";

/**
 * For admin pages: signed-out visitors go to sign in, non-staff get a 404 (so the admin area's
 * existence isn't confirmed), and staff without two-step verification are sent to turn it on.
 * `level: "admin"` limits the page to admins (settings, roles, audit log, payouts).
 */
export async function requireStaffPage(path: string, level: "staff" | "admin" = "staff"): Promise<CurrentUser> {
  const user = await requireUserOrRedirect(path);
  const allowed =
    level === "admin" ? can(user, "manage_settings", "platform", {}) : can(user, "view_admin", "platform", {});
  if (!allowed) notFound();
  if (!(await hasTwoFactor())) redirect("/admin/two-step");
  return user;
}

/** For admin server actions: the same checks, as errors instead of redirects. */
export async function staffHasTwoFactor() {
  return hasTwoFactor();
}
