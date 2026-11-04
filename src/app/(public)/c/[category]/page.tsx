import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { site } from "@/config/site";
import { parseListingSearch } from "@/lib/search-params";
import { categoryPath } from "@/lib/urls";
import { getCategoryBySlug } from "@/server/queries/catalog";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { ListingBrowser } from "@/components/listing-browser";
import { ListingGridSkeleton } from "@/components/listing-card";
import { Skeleton } from "@/components/ui/skeleton";

export async function generateMetadata({ params, searchParams }: PageProps<"/c/[category]">): Promise<Metadata> {
  const category = await getCategoryBySlug((await params).category);
  if (!category) return { title: "Not found" };
  const filtered = Object.keys(await searchParams).some((key) => key !== "page");
  return {
    title: `${category.name} for sale in ${site.launchCity}`,
    description: `Buy and sell ${category.name.toLowerCase()} in ${site.launchCity}. Payment held safely until delivery.`,
    alternates: { canonical: categoryPath(category.slug) },
    // Filtered views are near-duplicates of the category page.
    robots: filtered ? { index: false, follow: true } : undefined,
  };
}

export default function CategoryPage({ params, searchParams }: PageProps<"/c/[category]">) {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col gap-4">
          <Skeleton className="h-9 w-64" />
          <ListingGridSkeleton />
        </div>
      }
    >
      <Category params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Category({
  params,
  searchParams,
}: {
  params: Promise<{ category: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { category: slug } = await params;
  const category = await getCategoryBySlug(slug);
  // The proxy already answers unknown categories with a 404; this is a fallback.
  if (!category) notFound();
  const search = parseListingSearch(await searchParams, { category: category.slug });

  return (
    <div className="flex flex-col gap-4">
      <Breadcrumbs
        items={[
          { name: "Home", href: "/" },
          ...(category.parent ? [{ name: category.parent.name, href: categoryPath(category.parent.slug) }] : []),
          { name: category.name, href: categoryPath(category.slug) },
        ]}
      />
      <h1 className="text-2xl font-bold sm:text-3xl">{category.name}</h1>
      {category.children.length > 0 && (
        <nav aria-label={`${category.name} subcategories`}>
          <ul className="flex flex-wrap gap-2">
            {category.children.map((child) => (
              <li key={child.slug}>
                <Link
                  href={categoryPath(child.slug)}
                  className="border-border-strong hover:bg-surface-muted inline-flex h-11 items-center rounded-full border px-4 text-sm font-medium"
                >
                  {child.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
      <ListingBrowser search={search} basePath={categoryPath(category.slug)} />
    </div>
  );
}
