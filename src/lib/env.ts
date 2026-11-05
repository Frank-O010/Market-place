import { z } from "zod";

/**
 * Server environment variables, validated once at startup.
 * A missing or malformed variable fails fast with a clear message instead of
 * surfacing later as a confusing runtime error.
 */
const optionalUrl = z
  .url()
  .optional()
  .or(z.literal("").transform(() => undefined));
const optionalString = z
  .string()
  .min(1)
  .optional()
  .or(z.literal("").transform(() => undefined));

const serverSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

    // "clerk" in staging/production. "dev" is a local-only sign-in used for development and tests.
    AUTH_PROVIDER: z.enum(["clerk", "dev"]).default("clerk"),
    ALLOW_DEV_AUTH: z.enum(["true", "false"]).optional(),
    VERCEL_ENV: z.enum(["production", "preview", "development"]).optional(),
    CLERK_SECRET_KEY: optionalString,
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: optionalString,
    CLERK_WEBHOOK_SIGNING_SECRET: optionalString,

    UPSTASH_REDIS_REST_URL: optionalUrl,
    UPSTASH_REDIS_REST_TOKEN: optionalString,

    SENTRY_DSN: optionalUrl,
    NEXT_PUBLIC_SENTRY_DSN: optionalUrl,

    // Cloudflare R2 (S3-compatible) for listing photos. Without it, photos are stored on the
    // local disk in development and tests, and uploads are switched off on deployed sites.
    R2_ACCOUNT_ID: optionalString,
    R2_ACCESS_KEY_ID: optionalString,
    R2_SECRET_ACCESS_KEY: optionalString,
    R2_BUCKET: optionalString,
    NEXT_PUBLIC_IMAGE_ORIGIN: optionalUrl,
    // Signs local-disk upload links. A secret derived from DATABASE_URL is used when unset.
    UPLOAD_SIGNING_SECRET: optionalString,

    // Meilisearch for typo-tolerant search. Without it, search uses Postgres fuzzy matching.
    MEILISEARCH_HOST: optionalUrl,
    MEILISEARCH_ADMIN_KEY: optionalString,
    MEILISEARCH_INDEX_PREFIX: z
      .string()
      .regex(/^[a-z0-9_]*$/)
      .default(""),

    // Paystack: card and M-Pesa (STK push) payments, refunds and seller payouts.
    // Use the sk_test_ key until launch. Without it, local development and CI use a mock gateway
    // and deployed sites show "checkout isn't switched on yet".
    PAYSTACK_SECRET_KEY: z
      .string()
      .regex(/^sk_(test|live)_[A-Za-z0-9]+$/, "PAYSTACK_SECRET_KEY should start with sk_test_ or sk_live_")
      .optional()
      .or(z.literal("").transform(() => undefined)),

    // Resend for receipts and order emails. Without it, emails are kept in the dev outbox only.
    RESEND_API_KEY: optionalString,
    EMAIL_FROM: z.string().min(3).default("Soko <orders@soko.example>"),

    // Private R2 bucket (no public access) for ID documents and dispute photos. Uses the R2_*
    // credentials above. Without it, these uploads are switched off on deployed sites.
    R2_PRIVATE_BUCKET: optionalString,
    // 32 random bytes, base64 (`openssl rand -base64 32`). Encrypts sensitive fields such as the
    // ID document reference. Required for ID verification on a deployed site.
    ENCRYPTION_KEY: z
      .string()
      .refine((v) => Buffer.from(v, "base64").length === 32, "ENCRYPTION_KEY must be 32 bytes, base64-encoded")
      .optional()
      .or(z.literal("").transform(() => undefined)),

    // Africa's Talking for SMS (order updates). Without it, SMS are recorded but not sent.
    AT_USERNAME: optionalString,
    AT_API_KEY: optionalString,
    AT_SENDER_ID: optionalString,

    // PostHog product analytics (project API key, starts with phc_). Events are only sent for
    // people who accepted analytics cookies, through our own /api/analytics route (no PostHog script).
    NEXT_PUBLIC_POSTHOG_KEY: optionalString,
    POSTHOG_HOST: z.url().default("https://eu.i.posthog.com"),

    // Vercel sends this as a bearer token to cron routes (search index repair).
    CRON_SECRET: optionalString,

    NEXT_PUBLIC_SITE_URL: z.url().default("http://localhost:3000"),
    NEXT_PUBLIC_WHATSAPP_SUPPORT_NUMBER: z
      .string()
      .regex(/^\d{9,15}$/, "Use international format without + or spaces, e.g. 254700000000")
      .default("254700000000"),
  })
  .superRefine((env, ctx) => {
    // Dev sign-in must never reach a deployed site. Production builds only allow it when
    // ALLOW_DEV_AUTH=true (used by the end-to-end tests), and never on Vercel.
    const onVercel = env.VERCEL_ENV === "production" || env.VERCEL_ENV === "preview";
    const blocked = onVercel || (env.NODE_ENV === "production" && env.ALLOW_DEV_AUTH !== "true");
    if (env.AUTH_PROVIDER === "dev" && blocked) {
      ctx.addIssue({
        code: "custom",
        path: ["AUTH_PROVIDER"],
        message: "AUTH_PROVIDER=dev is for local development and tests only. Use clerk when deployed.",
      });
    }
    if (env.AUTH_PROVIDER === "clerk") {
      for (const key of ["CLERK_SECRET_KEY", "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"] as const) {
        if (!env[key]) {
          ctx.addIssue({ code: "custom", path: [key], message: `${key} is required when AUTH_PROVIDER=clerk` });
        }
      }
    }
    const r2Keys = ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET"] as const;
    const r2Set = r2Keys.filter((key) => env[key]);
    if (r2Set.length > 0 && r2Set.length < r2Keys.length) {
      for (const key of r2Keys.filter((k) => !env[k])) {
        ctx.addIssue({ code: "custom", path: [key], message: `${key} is required when any R2_* variable is set` });
      }
    }
    if (r2Set.length === r2Keys.length && !env.NEXT_PUBLIC_IMAGE_ORIGIN) {
      ctx.addIssue({
        code: "custom",
        path: ["NEXT_PUBLIC_IMAGE_ORIGIN"],
        message: "Set NEXT_PUBLIC_IMAGE_ORIGIN to the R2 bucket's public URL or custom domain",
      });
    }
    if (Boolean(env.MEILISEARCH_HOST) !== Boolean(env.MEILISEARCH_ADMIN_KEY)) {
      ctx.addIssue({
        code: "custom",
        path: ["MEILISEARCH_ADMIN_KEY"],
        message: "Set both MEILISEARCH_HOST and MEILISEARCH_ADMIN_KEY, or neither.",
      });
    }
    if (Boolean(env.AT_USERNAME) !== Boolean(env.AT_API_KEY)) {
      ctx.addIssue({
        code: "custom",
        path: ["AT_API_KEY"],
        message: "Set both AT_USERNAME and AT_API_KEY, or neither.",
      });
    }
    if (Boolean(env.UPSTASH_REDIS_REST_URL) !== Boolean(env.UPSTASH_REDIS_REST_TOKEN)) {
      ctx.addIssue({
        code: "custom",
        path: ["UPSTASH_REDIS_REST_TOKEN"],
        message: "Set both UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN, or neither.",
      });
    }
  });

export type ServerEnv = z.infer<typeof serverSchema>;

export function parseServerEnv(source: Record<string, string | undefined>): ServerEnv {
  const result = serverSchema.safeParse(source);
  if (!result.success) {
    const details = result.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid environment variables:\n${details}\nSee .env.example for the full list.`);
  }
  return result.data;
}

let cached: ServerEnv | undefined;

/** Lazily parsed so that importing this module never throws during client bundling. */
export function env(): ServerEnv {
  cached ??= parseServerEnv(process.env);
  return cached;
}
