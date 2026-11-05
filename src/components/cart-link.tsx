import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { getCurrentUser } from "@/server/auth/current-user";
import { db } from "@/server/db";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Cart button with an item count. Reads the session, so render inside <Suspense>. */
export async function CartLink() {
  const user = await getCurrentUser();
  const count = user
    ? ((await db.cartItem.aggregate({ where: { cart: { userId: user.id } }, _sum: { quantity: true } }))._sum
        .quantity ?? 0)
    : 0;
  const label = count ? `Cart, ${count} ${count === 1 ? "item" : "items"}` : "Cart";
  return (
    <Link
      href="/cart"
      aria-label={label}
      className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "relative")}
    >
      <ShoppingCart aria-hidden />
      {count > 0 && (
        <span
          aria-hidden
          className="bg-brand text-brand-foreground absolute top-1 right-1 flex min-w-5 items-center justify-center rounded-full px-1 text-xs font-bold"
        >
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}
