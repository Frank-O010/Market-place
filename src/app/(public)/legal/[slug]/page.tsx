import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LEGAL_REVIEWED, LEGAL_UPDATED, legalContent } from "@/config/legal";
import { legalPages, site } from "@/config/site";

export function generateStaticParams() {
  return legalPages.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps<"/legal/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const page = legalPages.find((p) => p.slug === slug);
  return { title: page?.title ?? "Not found" };
}

/** Draft legal text from src/config/legal.ts. Must be reviewed by a Kenyan lawyer before launch. */
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
  const sections = legalContent[page.slug] ?? [];
  return (
    <article className="mx-auto flex max-w-2xl flex-col gap-4">
      <h1 className="text-3xl font-bold">{page.title}</h1>
      <p className="text-muted text-sm">Last updated {LEGAL_UPDATED}</p>
      {!LEGAL_REVIEWED && (
        <p role="note" className="border-warning bg-warning-subtle rounded-md border p-4 text-sm">
          Draft. This page hasn&apos;t been reviewed by a lawyer yet and will be finalised before {site.name} launches.
        </p>
      )}
      {sections.map((section) => (
        <section key={section.heading} className="flex flex-col gap-2">
          <h2 className="text-xl font-semibold">{section.heading}</h2>
          {section.paragraphs.map((text) => (
            <p key={text.slice(0, 40)}>{text}</p>
          ))}
        </section>
      ))}
    </article>
  );
}
