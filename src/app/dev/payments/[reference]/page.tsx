import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { formatKes } from "@/lib/money";
import { devCompletePayment } from "@/server/actions/dev-payments";
import { db } from "@/server/db";
import { getPaymentGateway } from "@/server/payments";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Payment sandbox", robots: { index: false } };

/** Stand-in for Paystack's checkout page when the mock gateway is in use (local and CI only). */
export default function SandboxPage({ params, searchParams }: PageProps<"/dev/payments/[reference]">) {
  return (
    <Suspense>
      <Sandbox params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Sandbox({
  params,
  searchParams,
}: {
  params: Promise<{ reference: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (getPaymentGateway()?.mode !== "mock") notFound();
  const { reference } = await params;
  const { return: returnTo } = await searchParams;
  const payment = await db.payment.findUnique({
    where: { providerReference: decodeURIComponent(reference) },
    select: {
      providerReference: true,
      amountMinor: true,
      method: true,
      status: true,
      order: { select: { number: true } },
    },
  });
  if (!payment) notFound();
  return (
    <div className="mx-auto flex max-w-md flex-col gap-4">
      <h1 className="text-2xl font-bold">Payment sandbox</h1>
      <p role="note" className="border-warning bg-warning-subtle rounded-md border p-3 text-sm">
        Test mode. No real money moves. This page stands in for Paystack and the M-Pesa prompt.
      </p>
      <p>
        Order {payment.order.number}: <strong>{formatKes(payment.amountMinor)}</strong> by{" "}
        {payment.method === "MPESA" ? "M-Pesa" : "card"}. Status: {payment.status.toLowerCase()}.
      </p>
      <form action={devCompletePayment} className="flex gap-2">
        <input type="hidden" name="reference" value={payment.providerReference} />
        {typeof returnTo === "string" && <input type="hidden" name="return" value={returnTo} />}
        <Button type="submit" name="outcome" value="success">
          Approve payment
        </Button>
        <Button type="submit" name="outcome" value="failed" variant="secondary">
          Decline
        </Button>
      </form>
    </div>
  );
}
