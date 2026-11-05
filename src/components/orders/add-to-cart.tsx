"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { formatKes } from "@/lib/money";
import { addToCart } from "@/server/actions/cart";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";

type Variant = { id: string; name: string; priceOverrideMinor: number | null; stock: number };

export function AddToCart({
  listingId,
  priceMinor,
  stock,
  variants,
}: {
  listingId: string;
  priceMinor: number;
  stock: number;
  variants: Variant[];
}) {
  const router = useRouter();
  const [variantId, setVariantId] = React.useState(variants.find((v) => v.stock > 0)?.id ?? "");
  const [quantity, setQuantity] = React.useState(1);
  const [added, setAdded] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const variant = variants.find((v) => v.id === variantId);
  const available = variants.length ? (variant?.stock ?? 0) : stock;

  function add() {
    startTransition(async () => {
      const result = await addToCart({ listingId, variantId: variantId || null, quantity });
      if (!result.ok) {
        if (/sign in/i.test(result.error)) {
          router.push(`/sign-in?redirect_url=${encodeURIComponent(window.location.pathname)}`);
          return;
        }
        toast.error(result.error);
        return;
      }
      setAdded(true);
      toast.success("Added to your cart.");
      router.refresh();
    });
  }

  return (
    <div className="flex w-full flex-col gap-3">
      {variants.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="variant" className="text-sm font-medium">
            Option
          </label>
          <NativeSelect id="variant" value={variantId} onChange={(e) => setVariantId(e.target.value)}>
            {variants.map((v) => (
              <option key={v.id} value={v.id} disabled={v.stock <= 0}>
                {v.name}: {formatKes(v.priceOverrideMinor ?? priceMinor)}
                {v.stock <= 0 ? " (sold out)" : ""}
              </option>
            ))}
          </NativeSelect>
        </div>
      )}
      <div className="flex flex-wrap items-end gap-2">
        {available > 1 && (
          <div className="flex w-24 flex-col gap-1.5">
            <label htmlFor="quantity" className="text-sm font-medium">
              Quantity
            </label>
            <NativeSelect id="quantity" value={quantity} onChange={(e) => setQuantity(Number(e.target.value))}>
              {Array.from({ length: Math.min(available, 10) }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </NativeSelect>
          </div>
        )}
        <Button size="lg" onClick={add} disabled={pending || available <= 0} className="flex-1 sm:flex-none">
          <ShoppingCart aria-hidden /> {available <= 0 ? "Sold out" : pending ? "Adding…" : "Add to cart"}
        </Button>
        {added && (
          <Button asChild size="lg" variant="secondary">
            <Link href="/cart">Go to cart</Link>
          </Button>
        )}
      </div>
    </div>
  );
}
