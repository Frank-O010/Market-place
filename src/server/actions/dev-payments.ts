"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/server/db";
import { can } from "@/server/policy/can";
import { getPaymentGateway } from "@/server/payments";
import { signWebhook } from "@/server/payments/signature";

/**
 * Dev-only payment sandbox for the mock gateway: approves or declines a payment by sending a
 * correctly signed webhook to our own endpoint, exactly as Paystack would.
 */
export async function devCompletePayment(form: FormData) {
  const gateway = getPaymentGateway();
  if (gateway?.mode !== "mock" || !can({ id: "-", roles: [], status: "ACTIVE" }, "use_dev_tools", "platform", {})) {
    throw new Error("The payment sandbox is only available with the mock gateway.");
  }
  const reference = z.string().min(5).max(80).parse(form.get("reference"));
  const outcome = z.enum(["success", "failed"]).parse(form.get("outcome"));
  const returnTo = z
    .string()
    .optional()
    .parse(form.get("return") ?? undefined);
  const payment = await db.payment.findUnique({
    where: { providerReference: reference },
    select: { amountMinor: true, orderId: true },
  });
  if (!payment) throw new Error("Unknown payment reference");

  const body = JSON.stringify(
    outcome === "success"
      ? {
          event: "charge.success",
          data: { reference, amount: payment.amountMinor, currency: "KES", channel: "mobile_money" },
        }
      : { event: "charge.failed", data: { reference, gateway_response: "Declined in the sandbox" } },
  );
  // Local only (mock gateway), so the request's own host is the app itself.
  const origin = `http://${(await headers()).get("host")}`;
  const response = await fetch(`${origin}/api/webhooks/paystack`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-paystack-signature": signWebhook(gateway.webhookSecret, body) },
    body,
  });
  if (!response.ok) throw new Error(`Webhook was rejected: ${response.status}`);

  if (returnTo && returnTo.startsWith("http")) {
    const url = new URL(returnTo);
    url.searchParams.set("reference", reference);
    redirect(`${url.pathname}${url.search}`);
  }
  redirect(`/account/orders/${payment.orderId}`);
}
