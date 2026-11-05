import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { CheckCircle2 } from "lucide-react";
import { formatKes } from "@/lib/money";
import { fraudFlagLabels, type FraudFlag } from "@/lib/trust/fraud";
import { disputeReasons } from "@/lib/trust/schemas";
import { listingPath } from "@/lib/urls";
import { requireStaffPage } from "@/server/auth/staff";
import { AdminNav } from "@/components/admin/admin-nav";
import { decryptField } from "@/server/crypto";
import { db } from "@/server/db";
import { can } from "@/server/policy/can";
import * as actions from "@/server/actions/moderation";
import {
  FraudReview,
  ListingModeration,
  ModButton,
  SuspendUserButton,
  VerificationReview,
} from "@/components/admin/moderation-actions";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Moderation", robots: { index: false, follow: false } };

const tabs = [
  { key: "listings", label: "Listings to review" },
  { key: "reports", label: "Reports" },
  { key: "disputes", label: "Disputes" },
  { key: "orders", label: "Flagged orders" },
  { key: "verification", label: "ID checks" },
] as const;
type Tab = (typeof tabs)[number]["key"];

const when = (date: Date) =>
  new Intl.DateTimeFormat("en-KE", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Nairobi" }).format(
    date,
  );

export default function ModerationPage({ searchParams }: PageProps<"/admin/moderation">) {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-3xl font-bold">Moderation</h1>
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <Moderation searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Moderation({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireStaffPage("/admin/moderation");
  const requested = (await searchParams).tab;
  const tab: Tab = tabs.some((t) => t.key === requested) ? (requested as Tab) : "listings";
  const counts = await Promise.all([
    db.listing.count({ where: { status: "PENDING_REVIEW" } }),
    db.report.count({ where: { status: "OPEN" } }),
    db.dispute.count({ where: { status: { not: "RESOLVED" } } }),
    db.order.count({ where: { fraudFlags: { isEmpty: false }, fraudReviewedAt: null } }),
    db.sellerProfile.count({ where: { idVerificationStatus: "PENDING" } }),
  ]);

  return (
    <>
      <AdminNav current="/admin/moderation" isAdmin={can(user, "manage_settings", "platform", {})} />
      <nav aria-label="Moderation queues" className="-mx-4 overflow-x-auto px-4">
        <ul className="flex gap-2">
          {tabs.map((t, i) => (
            <li key={t.key}>
              <Link
                href={`/admin/moderation?tab=${t.key}`}
                aria-current={t.key === tab ? "page" : undefined}
                className={cn(
                  "border-border-strong flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm whitespace-nowrap",
                  t.key === tab && "bg-brand text-brand-foreground border-brand",
                )}
              >
                {t.label}
                <span className="font-bold">{counts[i]}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      {tab === "listings" && <ListingsQueue />}
      {tab === "reports" && <ReportsQueue />}
      {tab === "disputes" && <DisputesQueue />}
      {tab === "orders" && <FlaggedOrders />}
      {tab === "verification" && <VerificationQueue />}
    </>
  );
}

const Empty = () => <EmptyState icon={<CheckCircle2 />} title="Nothing waiting" description="This queue is clear." />;

async function ListingsQueue() {
  const listings = await db.listing.findMany({
    where: { status: "PENDING_REVIEW" },
    orderBy: { updatedAt: "asc" },
    take: 50,
    select: {
      id: true,
      slug: true,
      title: true,
      description: true,
      priceMinor: true,
      moderationNote: true,
      updatedAt: true,
      category: { select: { name: true } },
      seller: { select: { displayName: true, verificationTier: true, _count: { select: { listings: true } } } },
      images: { where: { status: "READY" }, take: 1, select: { storageKey: true } },
    },
  });
  if (listings.length === 0) return <Empty />;
  return (
    <ul className="flex flex-col gap-4" data-testid="listing-queue">
      {listings.map((l) => (
        <li key={l.id} className="border-border flex flex-col gap-2 rounded-lg border p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">{l.title}</h2>
            <span className="font-semibold">{formatKes(l.priceMinor)}</span>
          </div>
          <p className="text-muted text-sm">
            {l.category.name} · {l.seller.displayName} ({l.seller.verificationTier.toLowerCase().replace("_", " ")},{" "}
            {l.seller._count.listings} listings) · {when(l.updatedAt)}
          </p>
          {l.moderationNote && <p className="text-sm">Why it&apos;s here: {l.moderationNote}</p>}
          <p className="line-clamp-4 text-sm whitespace-pre-line">{l.description}</p>
          <ListingModeration listingId={l.id} />
        </li>
      ))}
    </ul>
  );
}

async function ReportsQueue() {
  const reports = await db.report.findMany({
    where: { status: "OPEN" },
    orderBy: { createdAt: "asc" },
    take: 200,
    select: { id: true, targetType: true, targetId: true, reason: true, details: true, createdAt: true },
  });
  if (reports.length === 0) return <Empty />;
  // One card per reported thing.
  const groups = new Map<string, typeof reports>();
  for (const r of reports) {
    const key = `${r.targetType}:${r.targetId}`;
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  return (
    <ul className="flex flex-col gap-4" data-testid="report-queue">
      {[...groups.values()].map((group) => (
        <li key={group[0]!.id} className="border-border flex flex-col gap-3 rounded-lg border p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="warning">{group[0]!.targetType.toLowerCase()}</Badge>
            <span className="text-muted text-sm">
              {group.length} report{group.length > 1 ? "s" : ""}, first {when(group[0]!.createdAt)}
            </span>
          </div>
          <ul className="list-disc pl-5 text-sm">
            {group.map((r) => (
              <li key={r.id}>
                {r.reason}
                {r.details ? `: ${r.details}` : ""}
              </li>
            ))}
          </ul>
          <ReportTarget targetType={group[0]!.targetType} targetId={group[0]!.targetId} reportId={group[0]!.id} />
        </li>
      ))}
    </ul>
  );
}

async function ReportTarget({
  targetType,
  targetId,
  reportId,
}: {
  targetType: string;
  targetId: string;
  reportId: string;
}) {
  const dismiss = (
    <ModButton
      label="Dismiss"
      variant="ghost"
      done="Report dismissed."
      action={actions.dismissReport.bind(null, reportId)}
    />
  );
  if (targetType === "LISTING") {
    const listing = await db.listing.findUnique({
      where: { id: targetId },
      select: {
        id: true,
        slug: true,
        title: true,
        status: true,
        seller: { select: { displayName: true, userId: true, user: { select: { status: true } } } },
      },
    });
    if (!listing) return dismiss;
    return (
      <div className="flex flex-col gap-2">
        <p>
          <Link href={listingPath(listing)} className="font-medium underline">
            {listing.title}
          </Link>{" "}
          by {listing.seller.displayName} <Badge>{listing.status.toLowerCase().replace("_", " ")}</Badge>
        </p>
        <div className="flex flex-wrap gap-2">
          <ListingModeration listingId={listing.id} />
          <SuspendUserButton userId={listing.seller.userId} suspended={listing.seller.user.status === "SUSPENDED"} />
          {dismiss}
        </div>
      </div>
    );
  }
  if (targetType === "USER") {
    const target = await db.user.findUnique({
      where: { id: targetId },
      select: {
        id: true,
        name: true,
        status: true,
        createdAt: true,
        sellerProfile: { select: { displayName: true, slug: true } },
      },
    });
    if (!target) return dismiss;
    return (
      <div className="flex flex-col gap-2">
        <p>
          {target.sellerProfile ? (
            <Link href={`/s/${target.sellerProfile.slug}`} className="font-medium underline">
              {target.sellerProfile.displayName}
            </Link>
          ) : (
            target.name
          )}{" "}
          · joined {when(target.createdAt)} · {target.status.toLowerCase()}
        </p>
        <div className="flex flex-wrap gap-2">
          <SuspendUserButton userId={target.id} suspended={target.status === "SUSPENDED"} />
          {dismiss}
        </div>
      </div>
    );
  }
  if (targetType === "MESSAGE") {
    const message = await db.message.findUnique({
      where: { id: targetId },
      select: {
        id: true,
        body: true,
        hiddenAt: true,
        conversationId: true,
        sender: { select: { id: true, name: true, status: true } },
      },
    });
    if (!message) return dismiss;
    return (
      <div className="flex flex-col gap-2">
        <blockquote className="bg-surface-muted rounded-md p-3 text-sm whitespace-pre-line">{message.body}</blockquote>
        <p className="text-sm">
          From {message.sender.name} ·{" "}
          <Link href={`/messages/${message.conversationId}`} className="underline">
            Read the conversation
          </Link>
        </p>
        <div className="flex flex-wrap gap-2">
          {!message.hiddenAt && (
            <ModButton
              label="Hide message"
              done="Message hidden."
              action={actions.hideMessage.bind(null, message.id)}
            />
          )}
          <SuspendUserButton userId={message.sender.id} suspended={message.sender.status === "SUSPENDED"} />
          {dismiss}
        </div>
      </div>
    );
  }
  const review = await db.review.findUnique({
    where: { id: targetId },
    select: { id: true, rating: true, body: true, hiddenAt: true, seller: { select: { displayName: true } } },
  });
  if (!review) return dismiss;
  return (
    <div className="flex flex-col gap-2">
      <blockquote className="bg-surface-muted rounded-md p-3 text-sm whitespace-pre-line">
        {review.rating}★ {review.body}
      </blockquote>
      <p className="text-sm">Review of {review.seller.displayName}</p>
      <div className="flex flex-wrap gap-2">
        {!review.hiddenAt && (
          <ModButton label="Hide review" done="Review hidden." action={actions.hideReview.bind(null, review.id)} />
        )}
        {dismiss}
      </div>
    </div>
  );
}

async function DisputesQueue() {
  const disputes = await db.dispute.findMany({
    where: { status: { not: "RESOLVED" } },
    orderBy: { createdAt: "asc" },
    take: 100,
    select: {
      id: true,
      reason: true,
      status: true,
      createdAt: true,
      order: { select: { number: true, totalMinor: true } },
    },
  });
  if (disputes.length === 0) return <Empty />;
  return (
    <ul className="divide-border border-border divide-y rounded-lg border" data-testid="dispute-queue">
      {disputes.map((d) => (
        <li key={d.id}>
          <Link href={`/admin/disputes/${d.id}`} className="hover:bg-surface-muted flex min-h-11 flex-col gap-1 p-4">
            <span className="font-medium">
              Order {d.order.number} · {formatKes(d.order.totalMinor)}
            </span>
            <span className="text-muted text-sm">
              {disputeReasons[d.reason as keyof typeof disputeReasons] ?? d.reason} ·{" "}
              {d.status.toLowerCase().replace("_", " ")} · {when(d.createdAt)}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

async function FlaggedOrders() {
  const orders = await db.order.findMany({
    where: { fraudFlags: { isEmpty: false }, fraudReviewedAt: null },
    orderBy: { createdAt: "asc" },
    take: 100,
    select: {
      id: true,
      number: true,
      status: true,
      totalMinor: true,
      fraudFlags: true,
      createdAt: true,
      buyer: { select: { name: true, email: true, createdAt: true } },
      seller: { select: { displayName: true } },
    },
  });
  if (orders.length === 0) return <Empty />;
  return (
    <ul className="flex flex-col gap-4" data-testid="flagged-orders">
      {orders.map((o) => (
        <li key={o.id} className="border-border flex flex-col gap-2 rounded-lg border p-4">
          <p className="font-medium">
            Order {o.number} · {formatKes(o.totalMinor)} · {o.status.toLowerCase().replace("_", " ")}
          </p>
          <p className="text-muted text-sm">
            Buyer {o.buyer?.name} ({o.buyer?.email ?? "no email"}), joined {o.buyer ? when(o.buyer.createdAt) : "?"} ·
            seller {o.seller.displayName}
          </p>
          <ul className="list-disc pl-5 text-sm">
            {o.fraudFlags.map((f) => (
              <li key={f}>{fraudFlagLabels[f as FraudFlag] ?? f}</li>
            ))}
          </ul>
          <FraudReview orderId={o.id} canRefund={o.status === "PAID_HELD"} />
        </li>
      ))}
    </ul>
  );
}

async function VerificationQueue() {
  const sellers = await db.sellerProfile.findMany({
    where: { idVerificationStatus: "PENDING" },
    orderBy: { idSubmittedAt: "asc" },
    take: 50,
    select: {
      id: true,
      displayName: true,
      slug: true,
      idDocumentKeyEnc: true,
      idSubmittedAt: true,
      user: { select: { name: true, phoneVerified: true, createdAt: true } },
    },
  });
  if (sellers.length === 0) return <Empty />;
  return (
    <ul className="flex flex-col gap-4" data-testid="verification-queue">
      {sellers.map((s) => {
        const key = s.idDocumentKeyEnc ? decryptField(s.idDocumentKeyEnc) : null;
        return (
          <li key={s.id} className="border-border flex flex-col gap-2 rounded-lg border p-4">
            <p className="font-medium">
              <Link href={`/s/${s.slug}`} className="underline">
                {s.displayName}
              </Link>{" "}
              · account name {s.user.name}
            </p>
            <p className="text-muted text-sm">
              Phone {s.user.phoneVerified ? "verified" : "not verified"} · joined {when(s.user.createdAt)} · sent{" "}
              {s.idSubmittedAt ? when(s.idSubmittedAt) : "?"}
            </p>
            {key && (
              <a
                href={`/api/private/${key}`}
                target="_blank"
                rel="noopener"
                className="text-brand self-start underline"
              >
                Open ID photo (staff only)
              </a>
            )}
            <p className="text-sm">
              Check the name matches the account, the photo is clear, and the document is valid.
            </p>
            <VerificationReview sellerId={s.id} />
          </li>
        );
      })}
    </ul>
  );
}
