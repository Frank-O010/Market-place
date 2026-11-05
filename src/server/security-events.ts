import "server-only";
import * as Sentry from "@sentry/nextjs";
import { audit } from "@/server/audit";

/**
 * Events we want alerts on. Each one goes to the audit log and to Sentry as a message tagged
 * `security_event:<kind>`, so Sentry alert rules can fire on spikes (see docs/monitoring.md).
 */
export type SecurityEventKind =
  "rate_limited" | "webhook_signature_failed" | "payment_failed" | "payment_mismatch" | "admin_action";

export async function securityEvent(
  kind: SecurityEventKind,
  input: {
    action: string;
    actorId?: string | null;
    targetType?: string;
    targetId?: string;
    ip?: string | null;
    metadata?: Record<string, string | number | boolean | null>;
  },
) {
  if (kind !== "rate_limited") {
    // Rate-limit hits are too frequent for the audit log; Sentry alone tracks those.
    await audit({ ...input, metadata: input.metadata ?? {} });
  }
  try {
    Sentry.captureMessage(`${kind}: ${input.action}`, {
      level: kind === "admin_action" ? "info" : "warning",
      tags: { security_event: kind, action: input.action },
      // Ids only: no personal data goes to Sentry.
      extra: { targetType: input.targetType, targetId: input.targetId, actorId: input.actorId },
      fingerprint: ["security_event", kind, input.action],
    });
  } catch {
    // Monitoring must never break the request.
  }
}
