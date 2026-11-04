import type { BadgeProps } from "@/components/ui/badge";

export const statusBadge: Record<string, { label: string; variant: BadgeProps["variant"] }> = {
  ACTIVE: { label: "Active", variant: "success" },
  DRAFT: { label: "Draft", variant: "neutral" },
  PAUSED: { label: "Paused", variant: "warning" },
  PENDING_REVIEW: { label: "In review", variant: "warning" },
  SOLD: { label: "Sold", variant: "brand" },
  REMOVED: { label: "Removed", variant: "danger" },
};
