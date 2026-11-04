import { Suspense } from "react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { parseListingSearch } from "@/lib/search-params";
import { checkRateLimit } from "@/server/rate-limit";
import { ListingBrowser } from "@/components/listing-browser";
import { ListingGridSkeleton } from "@/components/listing-card";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata: Metadata = {
  title: "Search",
  // Search result pages are endless combinations; let search engines index categories and listings instead.
  robots: { index: false, follow: true },
};

export default function SearchPage({ searchParams }: PageProps<"/search">) {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Search</h1>
      <Suspense fallback={<ListingGridSkeleton />}>
        <Results searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Results({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const search = parseListingSearch(await searchParams);
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const limit = await checkRateLimit("search", ip);
  if (!limit.success) {
    return (
      <EmptyState
        title="Slow down a little"
        description="You've searched a lot in the last minute. Please wait a moment and try again."
      />
    );
  }
  return <ListingBrowser search={search} basePath="/search" />;
}
