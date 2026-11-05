"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { updateCartItem } from "@/server/actions/cart";
import { Button } from "@/components/ui/button";

export function CartQuantity({ itemId, quantity, title }: { itemId: string; quantity: number; title: string }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const set = (next: number) =>
    startTransition(async () => {
      const result = await updateCartItem(itemId, next);
      if (!result.ok) toast.error(result.error);
      router.refresh();
    });
  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="icon"
        disabled={pending}
        aria-label={`One fewer ${title}`}
        onClick={() => set(quantity - 1)}
      >
        <Minus aria-hidden />
      </Button>
      <span className="min-w-6 text-center" aria-label={`Quantity ${quantity}`}>
        {quantity}
      </span>
      <Button
        variant="ghost"
        size="icon"
        disabled={pending}
        aria-label={`One more ${title}`}
        onClick={() => set(quantity + 1)}
      >
        <Plus aria-hidden />
      </Button>
      <Button variant="ghost" size="icon" disabled={pending} aria-label={`Remove ${title}`} onClick={() => set(0)}>
        <Trash2 aria-hidden />
      </Button>
    </div>
  );
}
