/**
 * Central authorisation policy. Every server action, route handler and data query that
 * touches a protected resource must go through `can()` or `assertCan()`.
 *
 * This module is pure (no database or request access) so that it is easy to test exhaustively.
 * Callers load the resource first, then ask whether the actor may act on it. Never decide
 * access from IDs supplied by the client.
 */

export type Role = "BUYER" | "SELLER" | "MODERATOR" | "ADMIN";
export type UserStatus = "ACTIVE" | "SUSPENDED" | "DELETED";

export type Actor = {
  id: string;
  roles: readonly Role[];
  status: UserStatus;
  /** Present when the user has a seller profile. */
  sellerProfileId?: string | null;
};

type ListingStatus = "DRAFT" | "PENDING_REVIEW" | "ACTIVE" | "PAUSED" | "SOLD" | "REMOVED";

export type Resources = {
  listing: { sellerId: string; status: ListingStatus };
  sellerProfile: { id: string; userId: string };
  order: { buyerId: string | null; sellerId: string };
  conversation: { buyerId: string; sellerId: string };
  payout: { sellerId: string };
  review: { authorId: string; order: { buyerId: string | null; sellerId: string } };
  dispute: { openedById: string; order: { buyerId: string | null; sellerId: string } };
  user: { id: string };
  platform: Record<string, never>;
};

export type Actions = {
  listing: "view" | "create" | "update" | "delete" | "moderate";
  sellerProfile: "view" | "update";
  order: "view" | "update_fulfilment" | "confirm_delivery" | "cancel" | "refund";
  conversation: "view" | "send_message";
  payout: "view" | "manage";
  review: "create" | "reply" | "moderate";
  dispute: "view" | "respond" | "resolve";
  user: "view_private" | "update" | "change_roles" | "suspend";
  platform: "view_admin" | "moderate" | "manage_settings" | "view_audit_log" | "use_dev_tools";
};

export type ResourceType = keyof Resources;

const hasRole = (actor: Actor, role: Role) => actor.roles.includes(role);
const isAdmin = (actor: Actor) => hasRole(actor, "ADMIN");
const isStaff = (actor: Actor) => isAdmin(actor) || hasRole(actor, "MODERATOR");
const ownsSeller = (actor: Actor, sellerId: string) =>
  hasRole(actor, "SELLER") && !!actor.sellerProfileId && actor.sellerProfileId === sellerId;

type Rules = {
  [R in ResourceType]: Record<Actions[R], (actor: Actor, resource: Resources[R]) => boolean>;
};

const rules: Rules = {
  listing: {
    // Anyone signed in can view active or sold listings; owners and staff see everything.
    // (Anonymous visitors are handled separately: public pages only query ACTIVE/SOLD listings.)
    view: (a, l) => l.status === "ACTIVE" || l.status === "SOLD" || ownsSeller(a, l.sellerId) || isStaff(a),
    create: (a, l) => ownsSeller(a, l.sellerId),
    update: (a, l) => ownsSeller(a, l.sellerId) && l.status !== "REMOVED",
    delete: (a, l) => ownsSeller(a, l.sellerId) || isAdmin(a),
    moderate: (a) => isStaff(a),
  },
  sellerProfile: {
    view: () => true,
    update: (a, p) => (a.id === p.userId && hasRole(a, "SELLER")) || isAdmin(a),
  },
  order: {
    view: (a, o) => a.id === o.buyerId || ownsSeller(a, o.sellerId) || isStaff(a),
    update_fulfilment: (a, o) => ownsSeller(a, o.sellerId),
    confirm_delivery: (a, o) => a.id === o.buyerId,
    cancel: (a, o) => a.id === o.buyerId || ownsSeller(a, o.sellerId) || isAdmin(a),
    refund: (a) => isAdmin(a),
  },
  conversation: {
    view: (a, c) => a.id === c.buyerId || ownsSeller(a, c.sellerId) || isStaff(a),
    // Staff can read conversations for moderation but cannot post as a participant.
    send_message: (a, c) => a.id === c.buyerId || ownsSeller(a, c.sellerId),
  },
  payout: {
    view: (a, p) => ownsSeller(a, p.sellerId) || isAdmin(a),
    manage: (a) => isAdmin(a),
  },
  review: {
    create: (a, r) => a.id === r.authorId && a.id === r.order.buyerId,
    reply: (a, r) => ownsSeller(a, r.order.sellerId),
    moderate: (a) => isStaff(a),
  },
  dispute: {
    view: (a, d) => a.id === d.order.buyerId || ownsSeller(a, d.order.sellerId) || isStaff(a),
    respond: (a, d) => a.id === d.order.buyerId || ownsSeller(a, d.order.sellerId),
    resolve: (a) => isStaff(a),
  },
  user: {
    view_private: (a, u) => a.id === u.id || isStaff(a),
    update: (a, u) => a.id === u.id || isAdmin(a),
    change_roles: (a) => isAdmin(a),
    suspend: (a, u) => isStaff(a) && a.id !== u.id,
  },
  platform: {
    view_admin: (a) => isStaff(a),
    moderate: (a) => isStaff(a),
    manage_settings: (a) => isAdmin(a),
    view_audit_log: (a) => isAdmin(a),
    use_dev_tools: () => process.env.NODE_ENV !== "production" || process.env.ALLOW_DEV_AUTH === "true",
  },
};

/**
 * Returns true when the actor may perform the action on the resource.
 * Suspended or deleted users can do nothing; a null actor (signed out) can do nothing here.
 */
export function can<R extends ResourceType>(
  actor: Actor | null | undefined,
  action: Actions[R],
  resourceType: R,
  resource: Resources[R],
): boolean {
  if (!actor || actor.status !== "ACTIVE") return false;
  const rule = rules[resourceType][action] as (a: Actor, r: Resources[R]) => boolean;
  return rule(actor, resource);
}

export class ForbiddenError extends Error {
  readonly status = 403;
  constructor(message = "You do not have permission to do that.") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export function assertCan<R extends ResourceType>(
  actor: Actor | null | undefined,
  action: Actions[R],
  resourceType: R,
  resource: Resources[R],
): asserts actor is Actor {
  if (!can(actor, action, resourceType, resource)) throw new ForbiddenError();
}
