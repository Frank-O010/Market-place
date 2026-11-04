"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { z } from "zod";
import { env } from "@/lib/env";
import { db } from "@/server/db";
import { audit } from "@/server/audit";
import { DEV_SESSION_COOKIE } from "@/server/auth/identity";
import { requireUser } from "@/server/auth/current-user";
import { can } from "@/server/policy/can";
import { enforceRateLimit, RateLimitError } from "@/server/rate-limit";
import { slugify } from "@/lib/utils";

/**
 * Local-only sign-in used for development and end-to-end tests (AUTH_PROVIDER=dev).
 * Every action re-checks that dev auth is enabled, so these can never run on a deployed site.
 */

function assertDevAuth() {
  if (
    env().AUTH_PROVIDER !== "dev" ||
    !can({ id: "-", roles: [], status: "ACTIVE" }, "use_dev_tools", "platform", {})
  ) {
    throw new Error("Dev sign-in is disabled.");
  }
}

async function clientIp() {
  return (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
}

async function setSession(authProviderId: string) {
  (await cookies()).set(DEV_SESSION_COOKIE, authProviderId, {
    httpOnly: true,
    sameSite: "lax",
    secure: env().NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

const safeRedirect = (value: FormDataEntryValue | null) => {
  const path = typeof value === "string" ? value : "/";
  // Only allow same-site relative paths to prevent open redirects.
  return path.startsWith("/") && !path.startsWith("//") ? path : "/";
};

export async function devSignIn(formData: FormData) {
  assertDevAuth();
  await enforceRateLimit("signIn", await clientIp());
  const userId = z.string().min(1).parse(formData.get("userId"));
  const user = await db.user.findUnique({ where: { id: userId }, select: { authProviderId: true, status: true } });
  if (!user || user.status === "DELETED") throw new Error("Unknown user.");
  await setSession(user.authProviderId);
  redirect(safeRedirect(formData.get("redirectTo")));
}

const signUpSchema = z.object({
  name: z.string().trim().min(2, "Enter your name").max(80),
  email: z.email("Enter a valid email address").max(200),
});

export type SignUpState = { errors?: Partial<Record<"name" | "email" | "form", string>> };

export async function devSignUp(_prev: SignUpState, formData: FormData): Promise<SignUpState> {
  assertDevAuth();
  try {
    await enforceRateLimit("signUp", await clientIp());
  } catch (error) {
    if (error instanceof RateLimitError) return { errors: { form: error.message } };
    throw error;
  }
  const parsed = signUpSchema.safeParse({ name: formData.get("name"), email: formData.get("email") });
  if (!parsed.success) {
    const errors: SignUpState["errors"] = {};
    for (const issue of parsed.error.issues) errors[issue.path[0] as "name" | "email"] ??= issue.message;
    return { errors };
  }
  const email = parsed.data.email.toLowerCase();
  if (await db.user.findUnique({ where: { email } })) {
    return { errors: { email: "An account with this email already exists. Sign in instead." } };
  }
  const authProviderId = `dev_${crypto.randomUUID()}`;
  await db.user.create({ data: { authProviderId, name: parsed.data.name, email, emailVerified: true } });
  await setSession(authProviderId);
  redirect(safeRedirect(formData.get("redirectTo")));
}

export async function devSignOut() {
  assertDevAuth();
  (await cookies()).delete(DEV_SESSION_COOKIE);
  redirect("/");
}

const roleSchema = z.enum(["SELLER", "MODERATOR", "ADMIN"]);

/** Dev-only: toggle one of your own roles so every view can be tested. Buyer is always kept. */
export async function devToggleRole(formData: FormData) {
  assertDevAuth();
  const user = await requireUser();
  await enforceRateLimit("roleChange", user.id);
  const role = roleSchema.parse(formData.get("role"));
  const roles = new Set(user.roles);
  if (roles.has(role)) roles.delete(role);
  else roles.add(role);
  roles.add("BUYER");

  await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: user.id }, data: { roles: [...roles] } });
    // Becoming a seller needs a seller profile; create a basic one the first time.
    if (role === "SELLER" && roles.has("SELLER")) {
      const existing = await tx.sellerProfile.findUnique({ where: { userId: user.id } });
      if (!existing) {
        await tx.sellerProfile.create({
          data: {
            userId: user.id,
            displayName: user.name,
            slug: `${slugify(user.name)}-${user.id.slice(-6)}`,
            location: "Nairobi",
          },
        });
      }
    }
  });
  await audit({
    action: "user.roles.dev_toggle",
    actorId: user.id,
    targetType: "user",
    targetId: user.id,
    ip: await clientIp(),
    metadata: { role, roles: [...roles] },
  });
  // Re-render the current page with the new roles. Nothing cached depends on roles.
  refresh();
}
