import { describe, expect, it } from "vitest";
import { assertCan, can, ForbiddenError, type Actor } from "./can";

const buyer: Actor = { id: "u_buyer", roles: ["BUYER"], status: "ACTIVE" };
const otherBuyer: Actor = { id: "u_buyer2", roles: ["BUYER"], status: "ACTIVE" };
const seller: Actor = { id: "u_seller", roles: ["BUYER", "SELLER"], status: "ACTIVE", sellerProfileId: "s_1" };
const otherSeller: Actor = { id: "u_seller2", roles: ["BUYER", "SELLER"], status: "ACTIVE", sellerProfileId: "s_2" };
const moderator: Actor = { id: "u_mod", roles: ["BUYER", "MODERATOR"], status: "ACTIVE" };
const admin: Actor = { id: "u_admin", roles: ["BUYER", "ADMIN"], status: "ACTIVE" };
const suspendedSeller: Actor = { ...seller, id: "u_susp", status: "SUSPENDED" };

const draftListing = { sellerId: "s_1", status: "DRAFT" as const };
const activeListing = { sellerId: "s_1", status: "ACTIVE" as const };
const order = { buyerId: "u_buyer", sellerId: "s_1" };

describe("listings", () => {
  it("lets the owning seller edit their listing", () => {
    expect(can(seller, "update", "listing", draftListing)).toBe(true);
  });

  it("stops another seller from editing someone else's listing", () => {
    expect(can(otherSeller, "update", "listing", draftListing)).toBe(false);
    expect(can(otherSeller, "delete", "listing", draftListing)).toBe(false);
  });

  it("stops a seller from creating a listing under another seller's profile", () => {
    expect(can(otherSeller, "create", "listing", { sellerId: "s_1", status: "DRAFT" })).toBe(false);
  });

  it("hides drafts from other users but shows them to staff", () => {
    expect(can(buyer, "view", "listing", draftListing)).toBe(false);
    expect(can(moderator, "view", "listing", draftListing)).toBe(true);
    expect(can(buyer, "view", "listing", activeListing)).toBe(true);
  });

  it("does not let a seller edit a listing that moderators removed", () => {
    expect(can(seller, "update", "listing", { sellerId: "s_1", status: "REMOVED" })).toBe(false);
  });

  it("requires the SELLER role, not just a matching profile id", () => {
    const formerSeller: Actor = { ...seller, roles: ["BUYER"] };
    expect(can(formerSeller, "update", "listing", draftListing)).toBe(false);
  });
});

describe("orders", () => {
  it("lets the buyer and the seller view the order", () => {
    expect(can(buyer, "view", "order", order)).toBe(true);
    expect(can(seller, "view", "order", order)).toBe(true);
  });

  it("stops other buyers and sellers from viewing the order", () => {
    expect(can(otherBuyer, "view", "order", order)).toBe(false);
    expect(can(otherSeller, "view", "order", order)).toBe(false);
  });

  it("only lets the buyer confirm delivery and only admins refund", () => {
    expect(can(buyer, "confirm_delivery", "order", order)).toBe(true);
    expect(can(seller, "confirm_delivery", "order", order)).toBe(false);
    expect(can(moderator, "refund", "order", order)).toBe(false);
    expect(can(admin, "refund", "order", order)).toBe(true);
  });

  it("does not treat a guest order (no buyer) as owned by anyone signed in", () => {
    expect(can(buyer, "view", "order", { buyerId: null, sellerId: "s_1" })).toBe(false);
  });
});

describe("conversations", () => {
  const conversation = { buyerId: "u_buyer", sellerId: "s_1" };

  it("lets participants message and stops outsiders", () => {
    expect(can(buyer, "send_message", "conversation", conversation)).toBe(true);
    expect(can(seller, "send_message", "conversation", conversation)).toBe(true);
    expect(can(otherBuyer, "view", "conversation", conversation)).toBe(false);
  });

  it("lets moderators read but not post", () => {
    expect(can(moderator, "view", "conversation", conversation)).toBe(true);
    expect(can(moderator, "send_message", "conversation", conversation)).toBe(false);
  });
});

describe("payouts, reviews and disputes", () => {
  it("only shows payouts to the owning seller and admins", () => {
    expect(can(seller, "view", "payout", { sellerId: "s_1" })).toBe(true);
    expect(can(otherSeller, "view", "payout", { sellerId: "s_1" })).toBe(false);
    expect(can(admin, "view", "payout", { sellerId: "s_1" })).toBe(true);
  });

  it("only lets the order's buyer write the review", () => {
    expect(can(buyer, "create", "review", { authorId: "u_buyer", order })).toBe(true);
    expect(can(otherBuyer, "create", "review", { authorId: "u_buyer2", order })).toBe(false);
  });

  it("lets staff resolve disputes, not the parties", () => {
    const dispute = { openedById: "u_buyer", order };
    expect(can(buyer, "resolve", "dispute", dispute)).toBe(false);
    expect(can(moderator, "resolve", "dispute", dispute)).toBe(true);
  });
});

describe("users and platform", () => {
  it("only lets admins change roles and settings", () => {
    expect(can(moderator, "change_roles", "user", { id: "u_buyer" })).toBe(false);
    expect(can(admin, "change_roles", "user", { id: "u_buyer" })).toBe(true);
    expect(can(moderator, "manage_settings", "platform", {})).toBe(false);
  });

  it("stops staff from suspending themselves", () => {
    expect(can(moderator, "suspend", "user", { id: "u_mod" })).toBe(false);
    expect(can(moderator, "suspend", "user", { id: "u_buyer" })).toBe(true);
  });

  it("lets buyers into nothing admin-related", () => {
    expect(can(buyer, "view_admin", "platform", {})).toBe(false);
    expect(can(moderator, "view_admin", "platform", {})).toBe(true);
  });
});

describe("account status", () => {
  it("denies everything to suspended users and signed-out visitors", () => {
    expect(can(suspendedSeller, "update", "listing", { sellerId: "s_1", status: "DRAFT" })).toBe(false);
    expect(can(null, "view", "listing", activeListing)).toBe(false);
  });

  it("assertCan throws a 403 ForbiddenError", () => {
    expect(() => assertCan(otherBuyer, "view", "order", order)).toThrow(ForbiddenError);
    try {
      assertCan(otherBuyer, "view", "order", order);
    } catch (error) {
      expect((error as ForbiddenError).status).toBe(403);
    }
  });
});
