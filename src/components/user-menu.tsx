import Link from "next/link";
import { LayoutDashboard, Menu, Package, Shield, Store, User, Wrench } from "lucide-react";
import { getCurrentUser } from "@/server/auth/current-user";
import { can } from "@/server/policy/can";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { SignOutButton } from "@/components/sign-out-button";

/** Reads the session, so it must render inside a <Suspense> boundary. */
export async function UserMenu() {
  const user = await getCurrentUser();
  if (!user) {
    return (
      <Button asChild variant="secondary">
        <Link href="/sign-in">Sign in</Link>
      </Button>
    );
  }

  const isSeller = user.roles.includes("SELLER");
  const showAdmin = can(user, "view_admin", "platform", {});
  const showDev = can(user, "use_dev_tools", "platform", {});
  const links = [
    { href: "/account", label: "My account", icon: User },
    { href: "/account/orders", label: "My orders", icon: Package },
    isSeller
      ? { href: "/sell", label: "Seller dashboard", icon: LayoutDashboard }
      : { href: "/sell", label: "Start selling", icon: Store },
    ...(showAdmin ? [{ href: "/admin", label: "Admin", icon: Shield }] : []),
    ...(showDev ? [{ href: "/dev/roles", label: "Dev: switch roles", icon: Wrench }] : []),
  ];

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Account menu for ${user.name}`}>
          <Menu aria-hidden />
        </Button>
      </SheetTrigger>
      <SheetContent side="right">
        <div>
          <SheetTitle>{user.name}</SheetTitle>
          <SheetDescription>{user.email ?? "Signed in"}</SheetDescription>
        </div>
        {user.status === "SUSPENDED" && (
          <p role="alert" className="bg-danger-subtle rounded-md p-3 text-sm">
            Your account is suspended. Contact support for help.
          </p>
        )}
        <nav aria-label="Account">
          <ul className="flex flex-col gap-1">
            {links.map(({ href, label, icon: Icon }) => (
              <li key={href + label}>
                <Button asChild variant="ghost" fullWidth className="justify-start">
                  <Link href={href}>
                    <Icon aria-hidden /> {label}
                  </Link>
                </Button>
              </li>
            ))}
          </ul>
        </nav>
        <div className="border-border mt-auto border-t pt-4">
          <SignOutButton />
        </div>
      </SheetContent>
    </Sheet>
  );
}
