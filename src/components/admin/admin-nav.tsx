import Link from "next/link";
import { cn } from "@/lib/utils";

const links = [
  { href: "/admin", label: "Overview", admin: false },
  { href: "/admin/moderation", label: "Moderation", admin: false },
  { href: "/admin/users", label: "Users", admin: false },
  { href: "/admin/listings", label: "Listings", admin: false },
  { href: "/admin/orders", label: "Orders", admin: false },
  { href: "/admin/payouts", label: "Payouts", admin: true },
  { href: "/admin/categories", label: "Categories", admin: true },
  { href: "/admin/settings", label: "Settings", admin: true },
  { href: "/admin/audit", label: "Audit log", admin: true },
] as const;

/**
 * Rendered by each admin page after its access check (not in a layout), so people who aren't
 * staff never see that the admin area exists.
 */
export function AdminNav({ current, isAdmin }: { current: string; isAdmin: boolean }) {
  return (
    <nav aria-label="Admin" className="-mx-4 overflow-x-auto px-4">
      <ul className="flex gap-1 border-b">
        {links
          .filter((l) => isAdmin || !l.admin)
          .map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                aria-current={l.href === current ? "page" : undefined}
                className={cn(
                  "text-muted hover:text-foreground flex min-h-11 items-center border-b-2 border-transparent px-3 text-sm whitespace-nowrap",
                  l.href === current && "border-brand text-foreground font-medium",
                )}
              >
                {l.label}
              </Link>
            </li>
          ))}
      </ul>
    </nav>
  );
}

export const when = (date: Date) =>
  new Intl.DateTimeFormat("en-KE", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Nairobi" }).format(
    date,
  );

/** Reads ?page= safely: a whole number from 1 to 500. */
export function pageParam(value: string | string[] | undefined) {
  const n = Number(Array.isArray(value) ? value[0] : value);
  return Number.isInteger(n) && n >= 1 && n <= 500 ? n : 1;
}

export function textParam(value: string | string[] | undefined, max = 100) {
  return (Array.isArray(value) ? value[0] : value)?.trim().slice(0, max) ?? "";
}
