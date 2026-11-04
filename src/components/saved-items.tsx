"use client";

import * as React from "react";
import { Heart } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { setSaved } from "@/server/actions/saved";
import { cn } from "@/lib/utils";

/**
 * Which listings the signed-in buyer has saved. Loaded once per page from /api/saved
 * (the catalogue pages themselves are cached and the same for everyone).
 */
type SavedState = { signedIn: boolean; ids: Set<string> } | null;
const SavedContext = React.createContext<{
  state: SavedState;
  update: (id: string, saved: boolean) => void;
} | null>(null);

export function SavedItemsProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<SavedState>(null);
  React.useEffect(() => {
    let cancelled = false;
    fetch("/api/saved", { credentials: "same-origin", cache: "no-store" })
      .then((res) => (res.ok ? res.json() : { signedIn: false, ids: [] }))
      .then((data: { signedIn: boolean; ids: string[] }) => {
        if (!cancelled) setState({ signedIn: data.signedIn, ids: new Set(data.ids) });
      })
      .catch(() => !cancelled && setState({ signedIn: false, ids: new Set() }));
    return () => {
      cancelled = true;
    };
  }, []);
  const update = React.useCallback((id: string, saved: boolean) => {
    setState((prev) => {
      if (!prev) return prev;
      const ids = new Set(prev.ids);
      if (saved) ids.add(id);
      else ids.delete(id);
      return { ...prev, ids };
    });
  }, []);
  return <SavedContext.Provider value={{ state, update }}>{children}</SavedContext.Provider>;
}

export function SaveButton({
  listingId,
  title,
  variant = "overlay",
  initialSaved,
}: {
  listingId: string;
  title: string;
  variant?: "overlay" | "inline";
  initialSaved?: boolean;
}) {
  const context = React.useContext(SavedContext);
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = React.useTransition();
  const [local, setLocal] = React.useState(initialSaved);
  const saved = local ?? context?.state?.ids.has(listingId) ?? false;

  function toggle() {
    if (context?.state && !context.state.signedIn) {
      router.push(`/sign-in?redirect_url=${encodeURIComponent(pathname)}`);
      return;
    }
    const next = !saved;
    setLocal(next);
    context?.update(listingId, next);
    startTransition(async () => {
      const result = await setSaved(listingId, next);
      if (!result.ok) {
        setLocal(!next);
        context?.update(listingId, !next);
        if (/sign in/i.test(result.error)) router.push(`/sign-in?redirect_url=${encodeURIComponent(pathname)}`);
        else toast.error(result.error);
        return;
      }
      toast.success(next ? "Saved. Find it under Saved items." : "Removed from saved items.");
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-pressed={saved}
      aria-label={saved ? `Remove ${title} from saved items` : `Save ${title}`}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full transition-colors disabled:opacity-60",
        variant === "overlay"
          ? "bg-surface/90 text-foreground hover:bg-surface absolute top-2 right-2 z-10 size-11 shadow-sm"
          : "border-border-strong hover:bg-surface-muted h-11 border px-4 text-sm font-medium",
      )}
    >
      <Heart className={cn("size-5", saved && "fill-danger text-danger")} aria-hidden />
      {variant === "inline" && <span>{saved ? "Saved" : "Save"}</span>}
    </button>
  );
}
