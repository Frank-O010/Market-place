import { Suspense } from "react";
import type { Metadata } from "next";
import { requireStaffPage } from "@/server/auth/staff";
import { getAllSettings } from "@/server/settings";
import { AdminNav } from "@/components/admin/admin-nav";
import { SettingsForm } from "@/components/admin/admin-forms";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Settings", robots: { index: false, follow: false } };

export default function AdminSettingsPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-3xl font-bold">Settings</h1>
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <Settings />
      </Suspense>
    </div>
  );
}

async function Settings() {
  await requireStaffPage("/admin/settings", "admin");
  const s = await getAllSettings();
  return (
    <>
      <AdminNav current="/admin/settings" isAdmin />
      <p className="text-muted text-sm">Changes apply straight away, and each one is written to the audit log.</p>
      <SettingsForm
        values={{
          commissionPercent: String(s.commission_bps / 100),
          deliveryFee: String(s.delivery_fee_minor / 100),
          autoReleaseDays: s.auto_release_days,
          prohibitedKeywords: s.prohibited_keywords,
          checkoutEnabled: s.checkout_enabled,
          reviewAllNewListings: s.review_all_new_listings,
        }}
      />
    </>
  );
}
