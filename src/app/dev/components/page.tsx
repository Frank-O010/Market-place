import type { Metadata } from "next";
import { Inbox, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Pagination } from "@/components/ui/pagination";
import { PriceTag } from "@/components/ui/price-tag";
import { Rating } from "@/components/ui/rating";
import { Skeleton } from "@/components/ui/skeleton";
import { ThemeToggle } from "@/components/theme-toggle";
import { ListingCard } from "@/components/listing-card";
import { GalleryInteractive } from "./interactive";

export const metadata: Metadata = { title: "Component gallery" };

const sampleListing = {
  id: "demo",
  slug: "samsung-galaxy-a54",
  title: "Samsung Galaxy A54 5G, 128GB, Awesome Graphite",
  priceMinor: 3_450_000,
  location: "Westlands",
  condition: "LIKE_NEW" as const,
  category: { name: "Phones" },
  images: [],
  seller: {
    displayName: "Wanjiku Electronics",
    ratingAverage: 470,
    ratingCount: 38,
    verificationTier: "ID_VERIFIED" as const,
  },
};

const swatches = [
  ["brand", "bg-brand"],
  ["brand-subtle", "bg-brand-subtle"],
  ["surface", "bg-surface"],
  ["surface-muted", "bg-surface-muted"],
  ["border-strong", "bg-border-strong"],
  ["success", "bg-success"],
  ["warning", "bg-warning"],
  ["danger", "bg-danger"],
] as const;

export default function ComponentGalleryPage() {
  return (
    <div className="flex flex-col gap-10">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-3xl font-bold">Component gallery</h1>
        <ThemeToggle />
      </header>

      <Section title="Colour tokens">
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {swatches.map(([name, cls]) => (
            <li key={name} className="flex items-center gap-2">
              <span className={`border-border size-10 rounded-md border ${cls}`} aria-hidden />
              <code className="text-sm">{name}</code>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Type scale">
        <div className="flex flex-col gap-1">
          <p className="text-3xl font-bold">Heading 3xl</p>
          <p className="text-2xl font-semibold">Heading 2xl</p>
          <p className="text-xl font-semibold">Heading xl</p>
          <p className="text-base">Body text is 16px for readability on phones.</p>
          <p className="text-muted text-sm">Secondary text uses the muted colour.</p>
        </div>
      </Section>

      <Section title="Buttons">
        <div className="flex flex-wrap items-center gap-2">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Danger</Button>
          <Button variant="link">Link</Button>
          <Button disabled>Disabled</Button>
          <Button size="sm">Small</Button>
          <Button size="lg">Large</Button>
          <Button size="icon" aria-label="Search">
            <Search aria-hidden />
          </Button>
        </div>
      </Section>

      <Section title="Form fields">
        <div className="grid max-w-md gap-4">
          <Field id="demo-title" label="Listing title" hint="Say what it is, the brand and the model.">
            <Input placeholder="e.g. Samsung Galaxy A54 128GB" />
          </Field>
          <Field id="demo-price" label="Price (KES)" error="Enter a price above zero.">
            <Input inputMode="decimal" defaultValue="0" />
          </Field>
        </div>
      </Section>

      <Section title="Select, dialog, sheet and toast">
        <GalleryInteractive />
      </Section>

      <Section title="Badges, price and rating">
        <div className="flex flex-wrap items-center gap-3">
          <Badge>Neutral</Badge>
          <Badge variant="brand">Brand</Badge>
          <Badge variant="success">Verified</Badge>
          <Badge variant="warning">Pending review</Badge>
          <Badge variant="danger">Removed</Badge>
          <Badge variant="outline">Outline</Badge>
        </div>
        <div className="flex flex-wrap items-center gap-6 pt-3">
          <PriceTag amount={125_000} />
          <PriceTag amount={99_900} compareAt={125_000} size="lg" />
          <Rating value={4.6} count={128} />
          <Rating value={3.5} />
        </div>
      </Section>

      <Section title="Cards">
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Order MP-24A9F3</CardTitle>
              <CardDescription>Payment held until you confirm delivery.</CardDescription>
            </CardHeader>
            <CardContent>
              <PriceTag amount={3_450_000} />
            </CardContent>
            <CardFooter>
              <Button>Confirm delivery</Button>
            </CardFooter>
          </Card>
          <div className="max-w-56">
            <ListingCard listing={sampleListing} />
          </div>
        </div>
      </Section>

      <Section title="Skeleton and empty state">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Skeleton className="aspect-video w-full" />
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-4 w-1/3" />
          </div>
          <EmptyState
            icon={<Inbox />}
            title="No messages yet"
            description="When buyers contact you, their messages show up here."
            action={<Button>Browse listings</Button>}
          />
        </div>
      </Section>

      <Section title="Pagination">
        <Pagination page={4} totalPages={12} hrefForPage={(p) => `/dev/components?page=${p}`} />
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="border-border border-b pb-2 text-xl font-semibold">{title}</h2>
      {children}
    </section>
  );
}
