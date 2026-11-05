import { describe, expect, it } from "vitest";
import { normaliseKenyanPhone, orderNumber, priceOrder } from "./pricing";
import { InvalidTransitionError, nextStatus, transition, type OrderEventType, type OrderStatus } from "./state";

describe("order state machine", () => {
  it("walks the happy path through every status", () => {
    let status: OrderStatus = "PENDING_PAYMENT";
    const path: OrderEventType[] = ["payment_succeeded", "shipped", "delivery_confirmed", "funds_released"];
    const seen: OrderStatus[] = [status];
    for (const event of path) {
      status = transition(status, event);
      seen.push(status);
    }
    expect(seen).toEqual(["PENDING_PAYMENT", "PAID_HELD", "SHIPPED", "DELIVERED", "COMPLETED"]);
  });

  it("never skips steps", () => {
    expect(() => transition("PENDING_PAYMENT", "shipped")).toThrow(InvalidTransitionError);
    expect(() => transition("PENDING_PAYMENT", "funds_released")).toThrow(InvalidTransitionError);
    expect(() => transition("PAID_HELD", "delivery_confirmed")).toThrow(InvalidTransitionError);
    expect(() => transition("COMPLETED", "seller_cancelled")).toThrow(InvalidTransitionError);
  });

  it("ignores a second payment success for an order that is already paid", () => {
    expect(nextStatus("PAID_HELD", "payment_succeeded")).toBeNull();
    expect(nextStatus("CANCELLED", "payment_succeeded")).toBeNull();
  });

  it("refunds when the seller cancels after payment, but only before shipping", () => {
    expect(transition("PAID_HELD", "seller_cancelled")).toBe("REFUNDED");
    expect(nextStatus("SHIPPED", "seller_cancelled")).toBeNull();
    expect(nextStatus("PAID_HELD", "buyer_cancelled")).toBeNull();
  });

  it("auto-releases shipped orders and lets disputes go either way", () => {
    expect(transition("SHIPPED", "auto_released")).toBe("DELIVERED");
    expect(transition("DELIVERED", "dispute_opened")).toBe("DISPUTED");
    expect(transition("DISPUTED", "dispute_resolved_for_seller")).toBe("DELIVERED");
    expect(transition("DISPUTED", "dispute_resolved_for_buyer")).toBe("REFUNDED");
    expect(nextStatus("COMPLETED", "dispute_opened")).toBeNull();
  });
});

describe("priceOrder", () => {
  it("charges commission on items only and pays the seller total minus commission", () => {
    const totals = priceOrder([{ unitPriceMinor: 1_250_000, quantity: 2 }], 30_000, 1000);
    expect(totals).toEqual({
      subtotalMinor: 2_500_000,
      deliveryFeeMinor: 30_000,
      platformFeeMinor: 250_000,
      totalMinor: 2_530_000,
      sellerPayoutMinor: 2_280_000,
    });
    expect(totals.sellerPayoutMinor).toBe(totals.totalMinor - totals.platformFeeMinor);
  });

  it("rounds commission half up to the nearest cent", () => {
    expect(priceOrder([{ unitPriceMinor: 105, quantity: 1 }], 0, 1000).platformFeeMinor).toBe(11);
  });

  it("rejects empty orders, bad quantities and fractional money", () => {
    expect(() => priceOrder([], 0, 1000)).toThrow();
    expect(() => priceOrder([{ unitPriceMinor: 100, quantity: 0 }], 0, 1000)).toThrow();
    expect(() => priceOrder([{ unitPriceMinor: 10.5, quantity: 1 }], 0, 1000)).toThrow();
    expect(() => priceOrder([{ unitPriceMinor: 100, quantity: 1 }], -1, 1000)).toThrow();
  });
});

describe("helpers", () => {
  it("makes readable order numbers", () => {
    expect(orderNumber()).toMatch(/^SK-[2-9A-HJ-NP-Z]{6}$/);
  });

  it("normalises Kenyan phone numbers", () => {
    expect(normaliseKenyanPhone("0712 345 678")).toBe("254712345678");
    expect(normaliseKenyanPhone("+254 712 345678")).toBe("254712345678");
    expect(normaliseKenyanPhone("0110345678")).toBe("254110345678");
    expect(normaliseKenyanPhone("12345")).toBeNull();
    expect(normaliseKenyanPhone("0812345678")).toBeNull();
  });
});
