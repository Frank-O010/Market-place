import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";

type AuditInput = {
  action: string;
  actorId?: string | null;
  targetType?: string;
  targetId?: string;
  ip?: string | null;
  metadata?: Prisma.InputJsonObject;
};

/**
 * Append-only audit trail for admin actions, role changes and anything touching money.
 * Failures are logged but never block the action itself.
 */
export async function audit(input: AuditInput) {
  try {
    await db.auditLog.create({
      data: {
        action: input.action,
        actorId: input.actorId ?? null,
        targetType: input.targetType,
        targetId: input.targetId,
        ip: input.ip?.split(",")[0]?.trim() ?? null,
        metadata: input.metadata ?? {},
      },
    });
  } catch (error) {
    console.error("[audit] failed to write audit log", { action: input.action, error });
  }
}
