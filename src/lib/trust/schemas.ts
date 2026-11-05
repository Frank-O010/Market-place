import { z } from "zod";

export const idSchema = z.string().regex(/^[a-z0-9]{20,40}$/i);

export const messageSchema = z.object({
  body: z.string().trim().min(1, "Write a message").max(2000, "Keep messages under 2,000 characters"),
});

export const reviewSchema = z.object({
  rating: z.coerce.number().int().min(1, "Choose a rating").max(5, "Choose a rating"),
  body: z.string().trim().max(1000, "Keep the review under 1,000 characters").optional().default(""),
});

export const sellerReplySchema = z.object({
  reply: z.string().trim().min(2, "Write a reply").max(1000, "Keep the reply under 1,000 characters"),
});

export const reportReasons = {
  LISTING: [
    "Prohibited or illegal item",
    "Counterfeit or fake",
    "Scam or misleading",
    "Wrong category or spam",
    "Something else",
  ],
  USER: ["Scam or fraud", "Harassment or abuse", "Pretending to be someone else", "Something else"],
  MESSAGE: ["Scam or asking to pay outside Soko", "Harassment or abuse", "Spam", "Something else"],
  REVIEW: ["Fake or not about this purchase", "Abusive or hateful", "Contains personal information", "Something else"],
} as const;

export type ReportTargetType = keyof typeof reportReasons;

export const reportSchema = z
  .object({
    targetType: z.enum(["LISTING", "USER", "MESSAGE", "REVIEW"]),
    targetId: idSchema,
    reason: z.string().min(1, "Choose a reason"),
    details: z.string().trim().max(1000, "Keep it under 1,000 characters").optional().default(""),
  })
  .refine((r) => (reportReasons[r.targetType] as readonly string[]).includes(r.reason), {
    message: "Choose a reason",
    path: ["reason"],
  });

export const disputeReasons = {
  NOT_RECEIVED: "I haven't received the item",
  NOT_AS_DESCRIBED: "The item isn't as described",
  DAMAGED: "The item arrived damaged or doesn't work",
  OTHER: "Something else",
} as const;

export const disputeSchema = z.object({
  reason: z.enum(Object.keys(disputeReasons) as [keyof typeof disputeReasons, ...(keyof typeof disputeReasons)[]], {
    message: "Choose what went wrong",
  }),
  details: z
    .string()
    .trim()
    .min(20, "Tell us a bit more (at least 20 characters) so we can help")
    .max(2000, "Keep it under 2,000 characters"),
});

export const disputeResponseSchema = z.object({
  response: z.string().trim().min(10, "Write at least 10 characters").max(2000, "Keep it under 2,000 characters"),
});

export const notificationPrefsSchema = z.object({
  messageEmail: z.boolean(),
  orderSms: z.boolean(),
});
export type NotificationPrefs = z.infer<typeof notificationPrefsSchema>;
export const defaultNotificationPrefs: NotificationPrefs = { messageEmail: true, orderSms: true };

export function readNotificationPrefs(value: unknown): NotificationPrefs {
  const partial = notificationPrefsSchema.partial().safeParse(value);
  return { ...defaultNotificationPrefs, ...(partial.success ? partial.data : {}) };
}

/** Average rating × 100, as stored on SellerProfile (e.g. 465 = 4.65). */
export function ratingSummary(ratings: number[]): { ratingAverage: number; ratingCount: number } {
  if (ratings.length === 0) return { ratingAverage: 0, ratingCount: 0 };
  const sum = ratings.reduce((a, b) => a + b, 0);
  return { ratingAverage: Math.round((sum * 100) / ratings.length), ratingCount: ratings.length };
}
