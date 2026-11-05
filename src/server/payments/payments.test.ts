import { describe, expect, it } from "vitest";
import { decideChargeFailed, decideChargeSuccess, decideTransfer } from "./decide";
import { signWebhook, verifyWebhookSignature } from "./signature";

const pending = { status: "PENDING" as const, amountMinor: 450_000 };
const open = { status: "PENDING_PAYMENT" };
const kes = { amount: 450_000, currency: "KES" };

describe("webhook signatures", () => {
  const body = JSON.stringify({ event: "charge.success", data: { reference: "SK-1" } });

  it("accepts a correct HMAC-SHA512 signature", () => {
    expect(verifyWebhookSignature("sk_test_x", body, signWebhook("sk_test_x", body))).toBe(true);
  });

  it("rejects a wrong secret, a changed body, or a missing or malformed signature", () => {
    const signature = signWebhook("sk_test_x", body);
    expect(verifyWebhookSignature("sk_test_y", body, signature)).toBe(false);
    expect(verifyWebhookSignature("sk_test_x", body.replace("SK-1", "SK-2"), signature)).toBe(false);
    expect(verifyWebhookSignature("sk_test_x", body, null)).toBe(false);
    expect(verifyWebhookSignature("sk_test_x", body, "abc")).toBe(false);
  });
});

describe("decideChargeSuccess", () => {
  it("marks a pending payment for an open order as paid", () => {
    expect(decideChargeSuccess(pending, open, kes)).toEqual({ action: "mark_paid" });
  });

  it("ignores duplicates and unknown references", () => {
    expect(decideChargeSuccess({ ...pending, status: "SUCCEEDED" }, { status: "PAID_HELD" }, kes)).toEqual({
      action: "ignore",
      reason: "duplicate",
    });
    expect(decideChargeSuccess(null, null, kes)).toEqual({ action: "ignore", reason: "unknown_reference" });
  });

  it("flags a payment for the wrong amount or currency instead of accepting it", () => {
    expect(decideChargeSuccess(pending, open, { amount: 1_000, currency: "KES" })).toEqual({
      action: "flag_amount_mismatch",
    });
    expect(decideChargeSuccess(pending, open, { amount: 450_000, currency: "NGN" })).toEqual({
      action: "flag_amount_mismatch",
    });
  });

  it("refunds a payment that arrives after the order was cancelled", () => {
    expect(decideChargeSuccess(pending, { status: "CANCELLED" }, kes)).toEqual({ action: "refund_late_payment" });
  });

  it("refunds a second successful attempt for an order that is already paid", () => {
    expect(decideChargeSuccess(pending, { status: "PAID_HELD" }, kes)).toEqual({ action: "refund_late_payment" });
  });
});

describe("out-of-order events", () => {
  it("never lets a late failure undo a success", () => {
    expect(decideChargeFailed({ ...pending, status: "SUCCEEDED" })).toEqual({ action: "ignore" });
    expect(decideChargeFailed(pending)).toEqual({ action: "mark_failed" });
    expect(decideChargeFailed(null)).toEqual({ action: "ignore" });
  });

  it("handles transfer events idempotently", () => {
    expect(decideTransfer({ status: "PROCESSING" }, "success")).toBe("mark_paid");
    expect(decideTransfer({ status: "PAID" }, "success")).toBe("ignore");
    expect(decideTransfer({ status: "PAID" }, "failed")).toBe("ignore");
    expect(decideTransfer({ status: "PROCESSING" }, "failed")).toBe("mark_failed");
    expect(decideTransfer({ status: "FAILED" }, "failed")).toBe("ignore");
    expect(decideTransfer(null, "success")).toBe("ignore");
  });
});
