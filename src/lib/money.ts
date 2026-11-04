/**
 * Money helpers. All amounts are integers in minor units (1 KES = 100 minor units).
 * Never use floating point numbers to store or calculate money.
 */

export type MinorUnits = number;

export const BASIS_POINTS = 10_000;

export function assertMinorUnits(value: number, label = "amount"): asserts value is MinorUnits {
  if (!Number.isSafeInteger(value)) {
    throw new TypeError(`${label} must be an integer number of minor units, got ${value}`);
  }
}

/** Convert a whole-shilling amount typed by a user (e.g. "1,250.50") to minor units. */
export function parseKes(input: string): MinorUnits {
  const cleaned = input.replace(/[,\s]/g, "").replace(/^KES|^KSh/i, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) {
    throw new Error(`"${input}" is not a valid KES amount`);
  }
  const [whole, fraction = ""] = cleaned.split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}

/**
 * Commission on an amount, given a rate in basis points (1000 bps = 10%).
 * Rounds half up to the nearest minor unit, so the platform never takes a fraction of a cent.
 */
export function commission(amount: MinorUnits, rateBps: number): MinorUnits {
  assertMinorUnits(amount);
  if (!Number.isInteger(rateBps) || rateBps < 0 || rateBps > BASIS_POINTS) {
    throw new RangeError(`Commission rate must be an integer between 0 and ${BASIS_POINTS} bps`);
  }
  return Math.floor((amount * rateBps + BASIS_POINTS / 2) / BASIS_POINTS);
}

const kesFormatter = new Intl.NumberFormat("en-KE", {
  style: "currency",
  currency: "KES",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

/** Format minor units for display, e.g. 125000 -> "Ksh 1,250". */
export function formatKes(amount: MinorUnits): string {
  assertMinorUnits(amount);
  return kesFormatter.format(amount / 100);
}
