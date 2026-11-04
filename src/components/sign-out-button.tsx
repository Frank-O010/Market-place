import { LogOut } from "lucide-react";
import { SignOutButton as ClerkSignOutButton } from "@clerk/nextjs";
import { devSignOut } from "@/server/actions/dev-auth";
import { Button } from "@/components/ui/button";

export function SignOutButton() {
  const label = (
    <>
      <LogOut aria-hidden /> Sign out
    </>
  );
  if (process.env.AUTH_PROVIDER === "dev") {
    return (
      <form action={devSignOut}>
        <Button type="submit" variant="ghost" fullWidth className="justify-start">
          {label}
        </Button>
      </form>
    );
  }
  return (
    <ClerkSignOutButton redirectUrl="/">
      <Button variant="ghost" fullWidth className="justify-start">
        {label}
      </Button>
    </ClerkSignOutButton>
  );
}
