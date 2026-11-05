import Link from "next/link";
import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Turn on two-step verification", robots: { index: false, follow: false } };

export default function TwoStepPage() {
  return (
    <div className="flex max-w-xl flex-col gap-4">
      <ShieldCheck className="text-brand size-10" aria-hidden />
      <h1 className="text-2xl font-bold">Turn on two-step verification</h1>
      <p>
        Staff accounts can refund money, suspend people and see ID documents, so they need a second sign-in step. Turn
        on an authenticator app or SMS codes, then come back.
      </p>
      <Button asChild className="self-start">
        <Link href="/account/security">Open security settings</Link>
      </Button>
    </div>
  );
}
