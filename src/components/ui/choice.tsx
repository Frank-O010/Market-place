import * as React from "react";

/** A large, tappable radio or checkbox with its label (44px touch target). */
export function Choice({
  children,
  type = "radio",
  ...props
}: React.ComponentProps<"input"> & { children: React.ReactNode }) {
  return (
    <label className="border-border-strong has-checked:border-brand has-checked:bg-brand-subtle flex min-h-11 cursor-pointer items-start gap-3 rounded-md border p-3 has-disabled:cursor-not-allowed has-disabled:opacity-60">
      <input type={type} className="mt-1 size-5 shrink-0" {...props} />
      <span>{children}</span>
    </label>
  );
}
