import * as React from "react";
import { cn } from "@/lib/utils";

/** A styled native <select>: best on phones, works without JavaScript and submits with forms. */
export function NativeSelect({ className, invalid, ...props }: React.ComponentProps<"select"> & { invalid?: boolean }) {
  return (
    <select
      aria-invalid={invalid || undefined}
      className={cn(
        "border-border-strong bg-surface text-foreground h-11 w-full rounded-md border px-3 text-base",
        "aria-[invalid=true]:border-danger disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({ className, invalid, ...props }: React.ComponentProps<"textarea"> & { invalid?: boolean }) {
  return (
    <textarea
      aria-invalid={invalid || undefined}
      className={cn(
        "border-border-strong bg-surface text-foreground placeholder:text-muted min-h-32 w-full rounded-md border px-3 py-2 text-base",
        "aria-[invalid=true]:border-danger",
        className,
      )}
      {...props}
    />
  );
}
