import type { Metadata, Viewport } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";
import { site } from "@/config/site";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/toast";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { CategoryNav } from "@/components/category-nav";
import { SavedItemsProvider } from "@/components/saved-items";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: { default: `${site.name}: ${site.tagline}`, template: `%s | ${site.name}` },
  description: site.description,
  applicationName: site.name,
  openGraph: { type: "website", siteName: site.name, locale: "en_KE" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#111827" },
  ],
};

function AuthProvider({ children }: { children: React.ReactNode }) {
  // The dev sign-in needs no provider. Clerk's provider is static-friendly (dynamic=false).
  if (process.env.AUTH_PROVIDER === "dev") return children;
  return <ClerkProvider>{children}</ClerkProvider>;
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-KE" suppressHydrationWarning className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <AuthProvider>
          <ThemeProvider>
            <SavedItemsProvider>
            <SiteHeader />
            <CategoryNav />
            <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
              {children}
            </main>
            <SiteFooter />
            <Toaster />
            </SavedItemsProvider>
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
