import { disputeReasons } from "@/lib/trust/schemas";
import { formatKes } from "@/lib/money";
import type { OrderDetail } from "@/server/queries/orders";
import { Badge } from "@/components/ui/badge";
import { DisputeResponseForm, SettleDisputeButton } from "./dispute-forms";

const statusText: Record<string, string> = {
  OPEN: "Waiting for the seller",
  AWAITING_SELLER: "Waiting for the seller",
  AWAITING_BUYER: "Waiting for the buyer",
  UNDER_REVIEW: "Our team is reviewing",
  RESOLVED: "Resolved",
};

const resolutionText = (d: NonNullable<OrderDetail["dispute"]>) =>
  d.resolution === "FULL_REFUND"
    ? "The buyer was refunded in full."
    : d.resolution === "PARTIAL_REFUND"
      ? `The buyer was refunded ${formatKes(d.refundAmountMinor ?? 0)} and the rest went to the seller.`
      : "The payment was released to the seller.";

/** The problem report on an order, for the buyer, the seller or staff. */
export function DisputePanel({
  order,
  perspective,
}: {
  order: OrderDetail;
  perspective: "buyer" | "seller" | "staff";
}) {
  const d = order.dispute;
  if (!d) return null;
  const open = d.status !== "RESOLVED";
  return (
    <section
      aria-labelledby="dispute-heading"
      className="border-warning bg-warning-subtle flex flex-col gap-3 rounded-lg border p-4"
      data-testid="dispute-panel"
    >
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="dispute-heading" className="text-lg font-semibold">
          Problem reported
        </h2>
        <Badge variant={open ? "warning" : "neutral"}>{statusText[d.status]}</Badge>
      </div>
      <p>
        <strong>{disputeReasons[d.reason as keyof typeof disputeReasons] ?? d.reason}.</strong>
      </p>
      <p className="whitespace-pre-line">{d.details}</p>
      {d.evidenceKeys.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Photos from the buyer">
          {d.evidenceKeys.map((key, i) => (
            <li key={key}>
              <a href={`/api/private/${key}`} target="_blank" rel="noopener" className="block">
                {/* Private images are served by an authorised route, so next/image can't optimise them. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/private/${key}`}
                  alt={`Photo ${i + 1} from the buyer`}
                  className="size-24 rounded-md object-cover"
                />
              </a>
            </li>
          ))}
        </ul>
      )}
      {d.sellerResponse && (
        <div className="bg-surface rounded-md p-3">
          <p className="text-sm font-medium">The seller&apos;s reply</p>
          <p className="whitespace-pre-line">{d.sellerResponse}</p>
        </div>
      )}
      {!open && (
        <p>
          <strong>Outcome:</strong> {resolutionText(d)} {d.resolutionNote}
        </p>
      )}
      {open && perspective === "buyer" && (
        <div className="flex flex-col gap-2">
          <p className="text-sm">
            Your payment is on hold. If the seller sorts it out, you can release the payment yourself.
          </p>
          <div>
            <SettleDisputeButton disputeId={d.id} outcome="release" />
          </div>
        </div>
      )}
      {open && perspective === "seller" && (
        <div className="flex flex-col gap-3">
          {!d.sellerResponse && <DisputeResponseForm disputeId={d.id} />}
          <div>
            <SettleDisputeButton disputeId={d.id} outcome="refund" />
          </div>
        </div>
      )}
    </section>
  );
}
