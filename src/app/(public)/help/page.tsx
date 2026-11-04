import type { Metadata } from "next";
import { MessageCircle } from "lucide-react";
import { site, whatsappSupportUrl } from "@/config/site";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Help centre" };

const faqs = [
  {
    q: "How is my payment protected?",
    a: `When you pay, ${site.name} holds the money. The seller is paid only after you confirm the item arrived, or a few days after delivery if you raise no problem.`,
  },
  { q: "How do I pay?", a: "With M-Pesa (you get a prompt on your phone) or with a debit or credit card." },
  {
    q: "Something went wrong with my order. What do I do?",
    a: "Open a dispute from the order page, or message us on WhatsApp.",
  },
];

export default function HelpPage() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <h1 className="text-3xl font-bold">Help centre</h1>
      <Button asChild size="lg" className="self-start">
        <a href={whatsappSupportUrl()} target="_blank" rel="noopener noreferrer">
          <MessageCircle aria-hidden /> Chat with us on WhatsApp
        </a>
      </Button>
      <section aria-labelledby="faq-heading" className="flex flex-col gap-2">
        <h2 id="faq-heading" className="text-xl font-semibold">
          Frequently asked questions
        </h2>
        {faqs.map(({ q, a }) => (
          <details key={q} className="border-border bg-surface rounded-md border p-4">
            <summary className="min-h-6 cursor-pointer font-medium">{q}</summary>
            <p className="text-muted mt-2">{a}</p>
          </details>
        ))}
      </section>
    </div>
  );
}
