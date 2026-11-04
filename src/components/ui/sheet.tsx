"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/** A panel that slides in from the edge. Used for the mobile menu and the filter drawer. */
export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;

const sides = {
  left: "inset-y-0 left-0 h-full w-[85%] max-w-sm border-r",
  right: "inset-y-0 right-0 h-full w-[85%] max-w-sm border-l",
  bottom: "inset-x-0 bottom-0 max-h-[85vh] rounded-t-xl border-t",
} as const;

export function SheetContent({
  side = "right",
  className,
  children,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & { side?: keyof typeof sides }) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50" />
      <DialogPrimitive.Content
        className={cn(
          "border-border bg-surface shadow-overlay fixed z-50 flex flex-col gap-4 overflow-y-auto p-6",
          sides[side],
          className,
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close className="text-muted hover:bg-surface-muted absolute top-3 right-3 inline-flex size-11 items-center justify-center rounded-md">
          <X className="size-5" aria-hidden />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function SheetTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return <DialogPrimitive.Title className={cn("pr-10 text-lg font-semibold", className)} {...props} />;
}

export function SheetDescription({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return <DialogPrimitive.Description className={cn("text-muted text-sm", className)} {...props} />;
}
