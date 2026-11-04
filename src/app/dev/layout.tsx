import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const metadata: Metadata = { robots: { index: false, follow: false } };

/** Dev tools. The proxy also blocks /dev in production; this is a second, independent check. */
export default function DevLayout({ children }: LayoutProps<"/dev">) {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_DEV_AUTH !== "true") notFound();
  return (
    <div className="flex flex-col gap-4">
      <p role="note" className="border-warning bg-warning-subtle rounded-md border px-4 py-2 text-sm">
        Development tools. These pages do not exist on the live site.
      </p>
      {children}
    </div>
  );
}
