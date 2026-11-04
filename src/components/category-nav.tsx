import Link from "next/link";
import { getTopCategories } from "@/server/queries/catalog";

/** Horizontally scrolling category chips. Cached, so it is part of the static shell. */
export async function CategoryNav() {
  const categories = await getTopCategories();
  if (categories.length === 0) return null;
  return (
    <nav aria-label="Categories" className="border-border bg-surface border-b">
      <ul className="mx-auto flex max-w-6xl [scrollbar-width:none] gap-2 overflow-x-auto px-4 py-2">
        {categories.map((category) => (
          <li key={category.id} className="shrink-0">
            <Link
              href={`/c/${category.slug}`}
              className="border-border-strong hover:bg-surface-muted inline-flex h-11 items-center rounded-full border px-4 text-sm font-medium whitespace-nowrap"
            >
              {category.name}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
