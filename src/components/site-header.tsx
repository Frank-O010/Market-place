import { Suspense } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { site } from "@/config/site";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SearchBar } from "@/components/search-bar";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu } from "@/components/user-menu";
import { CartLink } from "@/components/cart-link";
import { NotificationBell } from "@/components/notification-bell";

export function SiteHeader() {
  return (
    <header className="border-border bg-surface/95 supports-[backdrop-filter]:bg-surface/80 sticky top-0 z-40 border-b backdrop-blur">
      <a
        href="#main"
        className="focus:bg-brand focus:text-brand-foreground sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:px-4 focus:py-2"
      >
        Skip to content
      </a>
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2">
        <Link href="/" className="text-brand flex h-11 items-center text-xl font-bold tracking-tight">
          {site.name}
        </Link>
        <SearchBar className="order-last basis-full md:order-none md:max-w-xl md:flex-1 md:basis-auto" />
        <div className="ml-auto flex items-center gap-1">
          <Button asChild className="hidden sm:inline-flex">
            <Link href="/sell">
              <Plus aria-hidden /> Sell
            </Link>
          </Button>
          <ThemeToggle />
          <Suspense fallback={null}>
            <NotificationBell />
          </Suspense>
          <Suspense fallback={<Skeleton className="size-11" />}>
            <CartLink />
          </Suspense>
          <Suspense fallback={<Skeleton className="size-11" />}>
            <UserMenu />
          </Suspense>
        </div>
      </div>
    </header>
  );
}
