import { describe, expect, it } from "vitest";
import { findContactDetails } from "@/lib/messages/contact-details";
import { fraudFlags } from "./fraud";
import { defaultProhibitedKeywords, findProhibitedKeywords } from "./prohibited";
import { ratingSummary, readNotificationPrefs, reportSchema, reviewSchema } from "./schemas";

describe("findContactDetails", () => {
  it.each([
    ["Call me on 0712 345 678", ["phone"]],
    ["+254 712-345-678 anytime", ["phone"]],
    ["254712345678", ["phone"]],
    ["zero seven one two three four five six seven eight", ["phone"]],
    ["07I2 is not a number but 07l2345678 isn't either", []],
    ["email me: jane.doe@gmail.com", ["email"]],
    ["jane (at) gmail (dot) com", ["email"]],
    ["let's talk on WhatsApp", ["whatsapp"]],
    ["Is it still available? Price 12,500 ok?", []],
    ["I can collect on 12/11 at 3pm", []],
  ])("%s", (text, expected) => {
    expect(findContactDetails(text).sort()).toEqual([...expected].sort());
  });
});

describe("fraudFlags", () => {
  const now = new Date("2026-11-05T12:00:00Z");
  const base = {
    buyerCreatedAt: new Date("2026-01-01"),
    orderTotalMinor: 500_000,
    failedPaymentsLast24h: 0,
    accountsUsingPhoneLast30d: 1,
    now,
  };
  it("passes an ordinary order", () => expect(fraudFlags(base)).toEqual([]));
  it("flags a new account with a high-value order", () => {
    expect(
      fraudFlags({ ...base, buyerCreatedAt: new Date("2026-11-04T00:00:00Z"), orderTotalMinor: 2_000_000 }),
    ).toEqual(["NEW_ACCOUNT_HIGH_VALUE"]);
  });
  it("does not flag a new account with a small order", () => {
    expect(fraudFlags({ ...base, buyerCreatedAt: new Date("2026-11-04T00:00:00Z") })).toEqual([]);
  });
  it("flags many failed payments and shared phones", () => {
    expect(fraudFlags({ ...base, failedPaymentsLast24h: 3, accountsUsingPhoneLast30d: 3 })).toEqual([
      "MANY_FAILED_PAYMENTS",
      "SHARED_PHONE",
    ]);
  });
});

describe("findProhibitedKeywords", () => {
  it("matches whole words and plurals", () => {
    expect(findProhibitedKeywords("Air rifles for sale", defaultProhibitedKeywords)).toEqual(["rifle"]);
    expect(findProhibitedKeywords("Original Nike, not a replica", defaultProhibitedKeywords)).toEqual(["replica"]);
  });
  it("ignores words that merely contain a keyword", () => {
    expect(findProhibitedKeywords("Gunmetal grey sofa, begun", defaultProhibitedKeywords)).toEqual([]);
    expect(findProhibitedKeywords("Passports holder? No: a leather wallet", ["passport"])).toEqual(["passport"]);
  });
});

describe("schemas", () => {
  it("requires a rating from 1 to 5", () => {
    expect(reviewSchema.safeParse({ rating: "0" }).success).toBe(false);
    expect(reviewSchema.safeParse({ rating: "5", body: "Great" }).success).toBe(true);
  });
  it("only accepts report reasons for the right target", () => {
    const id = "c".repeat(25);
    expect(reportSchema.safeParse({ targetType: "LISTING", targetId: id, reason: "Counterfeit or fake" }).success).toBe(
      true,
    );
    expect(reportSchema.safeParse({ targetType: "MESSAGE", targetId: id, reason: "Counterfeit or fake" }).success).toBe(
      false,
    );
  });
  it("summarises ratings as average × 100", () => {
    expect(ratingSummary([5, 4, 4])).toEqual({ ratingAverage: 433, ratingCount: 3 });
    expect(ratingSummary([])).toEqual({ ratingAverage: 0, ratingCount: 0 });
  });
  it("fills in missing notification preferences", () => {
    expect(readNotificationPrefs({ messageEmail: false })).toEqual({ messageEmail: false, orderSms: true });
    expect(readNotificationPrefs("junk")).toEqual({ messageEmail: true, orderSms: true });
  });
});
