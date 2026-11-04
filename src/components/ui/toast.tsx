"use client";

import { Toaster as Sonner, toast } from "sonner";
import { useTheme } from "next-themes";

/** App-wide toast outlet. Call `toast.success("Saved")` from client components. */
export function Toaster() {
  const { resolvedTheme } = useTheme();
  return (
    <Sonner
      theme={resolvedTheme === "dark" ? "dark" : "light"}
      position="top-center"
      richColors
      closeButton
      toastOptions={{ className: "text-base" }}
    />
  );
}

export { toast };
