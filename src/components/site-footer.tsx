import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { legalPages, site, whatsappSupportUrl } from "@/config/site";

export function SiteFooter() {
  return (
    <footer className="border-border bg-surface mt-auto border-t">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-8 sm:grid-cols-3">
        <div className="flex flex-col gap-2">
          <p className="text-brand text-lg font-bold">{site.name}</p>
          <p className="text-muted text-sm">{site.tagline}. Payment is held until you confirm delivery.</p>
        </div>
        <nav aria-label="Help">
          <h2 className="mb-2 text-sm font-semibold">Help</h2>
          <ul className="flex flex-col text-sm">
            <li>
              <a
                href={whatsappSupportUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted hover:text-foreground inline-flex min-h-11 items-center gap-2"
              >
                <MessageCircle className="size-4" aria-hidden /> WhatsApp support
              </a>
            </li>
            <li>
              <Link href="/help" className="text-muted hover:text-foreground inline-flex min-h-11 items-center">
                Help centre and FAQ
              </Link>
            </li>
            <li>
              <Link href="/sell" className="text-muted hover:text-foreground inline-flex min-h-11 items-center">
                Sell on {site.name}
              </Link>
            </li>
          </ul>
        </nav>
        <nav aria-label="Legal">
          <h2 className="mb-2 text-sm font-semibold">Legal</h2>
          <ul className="flex flex-col text-sm">
            {legalPages.map((page) => (
              <li key={page.slug}>
                <Link
                  href={`/legal/${page.slug}`}
                  className="text-muted hover:text-foreground inline-flex min-h-11 items-center"
                >
                  {page.title}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      <p className="border-border text-muted border-t px-4 py-4 text-center text-xs">
        © {site.name}. Built in {site.launchCity}.
      </p>
    </footer>
  );
}
