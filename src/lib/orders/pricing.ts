import { assertMinorUnits, commission, type MinorUnits } from "@/lib/money";

export type PricedLine = { unitPriceMinor: MinorUnits; quantity: number };

export type OrderTotals = {
  subtotalMinor: MinorUnits;
  deliveryFeeMinor: MinorUnits;
  platformFeeMinor: MinorUnits;
  totalMinor: MinorUnits;
  /** What the seller receives when funds are released: total minus commission. */
  sellerPayoutMinor: MinorUnits;
};

/**
 * Prices an order. Commission is charged on the items only (not on delivery, which the seller
 * passes on at cost), and deducted from the seller's payout. The buyer pays the subtotal plus delivery.
 */
export function priceOrder(lines: PricedLine[], deliveryFeeMinor: MinorUnits, commissionBps: number): OrderTotals {
  if (lines.length === 0) throw new RangeError("An order needs at least one item");
  assertMinorUnits(deliveryFeeMinor, "delivery fee");
  if (deliveryFeeMinor < 0) throw new RangeError("Delivery fee can't be negative");
  let subtotalMinor = 0;
  for (const line of lines) {
    assertMinorUnits(line.unitPriceMinor, "unit price");
    if (!Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > 99) {
      throw new RangeError("Quantity must be between 1 and 99");
    }
    if (line.unitPriceMinor <= 0) throw new RangeError("Unit price must be positive");
    subtotalMinor += line.unitPriceMinor * line.quantity;
  }
  assertMinorUnits(subtotalMinor, "subtotal");
  const platformFeeMinor = commission(subtotalMinor, commissionBps);
  const totalMinor = subtotalMinor + deliveryFeeMinor;
  return {
    subtotalMinor,
    deliveryFeeMinor,
    platformFeeMinor,
    totalMinor,
    sellerPayoutMinor: totalMinor - platformFeeMinor,
  };
}

/** Human-friendly order number, e.g. "SK-7Q2M9X". No 0/O or 1/I to avoid misreading over the phone. */
export function orderNumber(random: () => number = Math.random): string {
  const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  let out = "";
  for (let i = 0; i < 6; i++) out += alphabet[Math.floor(random() * alphabet.length)];
  return `SK-${out}`;
}

/** Normalises a Kenyan mobile number to 2547XXXXXXXX / 2541XXXXXXXX, or returns null. */
export function normaliseKenyanPhone(input: string): string | null {
  const digits = input.replace(/[\s()-]/g, "").replace(/^\+/, "");
  const match = /^(?:254|0)?([17]\d{8})$/.exec(digits);
  return match ? `254${match[1]}` : null;
}
