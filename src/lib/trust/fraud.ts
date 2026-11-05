/**
 * Basic fraud signals checked when an order is paid. A flagged order still goes ahead for the
 * buyer, but the seller's payout waits until staff have looked at it.
 */

export const FRAUD_RULES = {
  /** An account younger than this placing an order worth at least highValueMinor. */
  newAccountDays: 7,
  highValueMinor: 2_000_000, // KES 20,000
  /** This many failed payments by the buyer in the last 24 hours. */
  failedPayments24h: 3,
  /** The same M-Pesa number used by this many different accounts in 30 days. */
  accountsPerPhone30d: 3,
} as const;

export type FraudFlag = "NEW_ACCOUNT_HIGH_VALUE" | "MANY_FAILED_PAYMENTS" | "SHARED_PHONE";

export const fraudFlagLabels: Record<FraudFlag, string> = {
  NEW_ACCOUNT_HIGH_VALUE: "New account placing a high-value order",
  MANY_FAILED_PAYMENTS: "Several failed payments in the last day",
  SHARED_PHONE: "Payment phone number used by several accounts",
};

export type FraudFacts = {
  buyerCreatedAt: Date;
  orderTotalMinor: number;
  failedPaymentsLast24h: number;
  accountsUsingPhoneLast30d: number;
  now: Date;
};

export function fraudFlags(facts: FraudFacts): FraudFlag[] {
  const flags: FraudFlag[] = [];
  const ageDays = (facts.now.getTime() - facts.buyerCreatedAt.getTime()) / 86_400_000;
  if (ageDays < FRAUD_RULES.newAccountDays && facts.orderTotalMinor >= FRAUD_RULES.highValueMinor) {
    flags.push("NEW_ACCOUNT_HIGH_VALUE");
  }
  if (facts.failedPaymentsLast24h >= FRAUD_RULES.failedPayments24h) flags.push("MANY_FAILED_PAYMENTS");
  if (facts.accountsUsingPhoneLast30d >= FRAUD_RULES.accountsPerPhone30d) flags.push("SHARED_PHONE");
  return flags;
}
