import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { legalPages, site } from "@/config/site";

export function generateStaticParams() {
  return legalPages.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps<"/legal/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const page = legalPages.find((p) => p.slug === slug);
  return { title: page?.title ?? "Not found" };
}

/** Placeholder legal text. Must be replaced and reviewed by a lawyer before launch (see docs/decisions.md). */
export default function LegalPage({ params }: PageProps<"/legal/[slug]">) {
  // params are read inside a boundary so the route stays prerenderable when it is revalidated.
  return (
    <Suspense>
      <LegalContent params={params} />
    </Suspense>
  );
}

async function LegalContent({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = legalPages.find((p) => p.slug === slug);
  if (!page) notFound();
  return (
    <article className="mx-auto flex max-w-2xl flex-col gap-4">
      <h1 className="text-3xl font-bold">{page.title}</h1>
      <p role="note" className="border-warning bg-warning-subtle rounded-md border p-4 text-sm">
        Placeholder text. This page has not been written or reviewed by a lawyer yet and must be replaced before{" "}
        {site.name} launches.
      </p>
      <p className="text-muted">
        This page will explain the {page.title.toLowerCase()} for {site.name}, in line with Kenyan law including the
        Data Protection Act, 2019.
      </p>
    </article>
  );
}
