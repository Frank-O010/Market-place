import { Suspense } from "react";
import type { Metadata } from "next";
import { requireStaffPage } from "@/server/auth/staff";
import { db } from "@/server/db";
import { AdminNav } from "@/components/admin/admin-nav";
import { CategoryForm, DeleteCategoryButton } from "@/components/admin/admin-forms";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Categories", robots: { index: false, follow: false } };

export default function AdminCategoriesPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-3xl font-bold">Categories</h1>
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <Categories />
      </Suspense>
    </div>
  );
}

async function Categories() {
  await requireStaffPage("/admin/categories", "admin");
  const categories = await db.category.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      slug: true,
      parentId: true,
      sortOrder: true,
      _count: { select: { listings: true, children: true } },
    },
  });
  const top = categories.filter((c) => !c.parentId);
  const childrenOf = (id: string) => categories.filter((c) => c.parentId === id);
  const parents = top.map((c) => ({ id: c.id, name: c.name }));

  const row = (c: (typeof categories)[number]) => (
    <li key={c.id} className="flex flex-col gap-2 rounded-md border p-3" data-testid="admin-category">
      <p className="text-muted text-sm">
        /c/{c.slug} · {c._count.listings} listings{c._count.children > 0 && ` · ${c._count.children} subcategories`}
      </p>
      <CategoryForm category={c} parents={parents} />
      {c._count.listings === 0 && c._count.children === 0 && (
        <div>
          <DeleteCategoryButton categoryId={c.id} name={c.name} />
        </div>
      )}
    </li>
  );

  return (
    <>
      <AdminNav current="/admin/categories" isAdmin />
      <section aria-labelledby="new-category" className="flex flex-col gap-3 rounded-lg border p-4">
        <h2 id="new-category" className="text-xl font-semibold">
          Add a category
        </h2>
        <p className="text-muted text-sm">
          Web addresses are made from the name and don&apos;t change when you rename, so old links keep working.
        </p>
        <CategoryForm parents={parents} />
      </section>
      <ul className="flex flex-col gap-4">
        {top.map((c) => (
          <li key={c.id} className="flex flex-col gap-2">
            <ul className="flex flex-col gap-2">{row(c)}</ul>
            {childrenOf(c.id).length > 0 && (
              <ul className="ml-4 flex flex-col gap-2 border-l pl-4" aria-label={`${c.name} subcategories`}>
                {childrenOf(c.id).map(row)}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}
