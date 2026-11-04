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
