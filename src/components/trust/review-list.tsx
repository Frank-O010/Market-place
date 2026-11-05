import { Star } from "lucide-react";
import { Rating } from "@/components/ui/rating";
import { EmptyState } from "@/components/ui/empty-state";
import { ReportButton } from "./report-button";

export type ReviewItem = {
  id: string;
  rating: number;
  body: string | null;
  sellerReply: string | null;
  createdAt: Date;
  authorName: string;
  itemTitle: string | null;
};

const day = (date: Date) =>
  new Intl.DateTimeFormat("en-KE", { dateStyle: "medium", timeZone: "Africa/Nairobi" }).format(date);

export function ReviewList({
  reviews,
  sellerName,
  signedIn,
}: {
  reviews: ReviewItem[];
  sellerName: string;
  signedIn: boolean;
}) {
  if (reviews.length === 0) {
    return (
      <EmptyState
        icon={<Star />}
        title="No reviews yet"
        description="Reviews come from buyers who completed an order."
      />
    );
  }
  return (
    <ul className="flex flex-col gap-4" data-testid="review-list">
      {reviews.map((r) => (
        <li key={r.id} className="border-border flex flex-col gap-2 rounded-lg border p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Rating value={r.rating} />
            <span className="text-muted text-xs">{day(r.createdAt)}</span>
          </div>
          {r.body && <p className="whitespace-pre-line">{r.body}</p>}
          <p className="text-muted text-sm">
            {r.authorName}, verified purchase{r.itemTitle ? ` of ${r.itemTitle}` : ""}
          </p>
          {r.sellerReply && (
            <div className="bg-surface-muted rounded-md p-3 text-sm">
              <p className="font-medium">Reply from {sellerName}</p>
              <p className="whitespace-pre-line">{r.sellerReply}</p>
            </div>
          )}
          <div>
            <ReportButton targetType="REVIEW" targetId={r.id} signedIn={signedIn} compact />
          </div>
        </li>
      ))}
    </ul>
  );
}
