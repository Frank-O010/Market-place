import Link from "next/link";
import { SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export default function NotFound() {
  return (
    <EmptyState
      icon={<SearchX />}
      title="We couldn't find that page"
      description="It may have been moved or removed. Try searching, or head back home."
      action={
        <Button asChild>
          <Link href="/">Go home</Link>
        </Button>
      }
    />
  );
}
