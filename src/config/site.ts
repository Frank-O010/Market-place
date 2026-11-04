/**
 * Brand and launch settings. Placeholder values until the brand is chosen.
 * Business rules that admins change (commission, fees) live in PlatformSetting, not here.
 */
export const site = {
  name: "Soko",
  tagline: "Buy and sell safely in Nairobi",
  description:
    "A marketplace where buyers and sellers in Nairobi trade safely, with payment held until delivery is confirmed.",
  launchCity: "Nairobi",
  currency: "KES",
  locale: "en-KE",
} as const;

export const legalPages = [
  { slug: "terms", title: "Terms of service" },
  { slug: "seller-agreement", title: "Seller agreement" },
  { slug: "prohibited-items", title: "Prohibited items" },
  { slug: "privacy", title: "Privacy policy" },
  { slug: "cookies", title: "Cookie policy" },
  { slug: "refunds-and-disputes", title: "Refund and dispute policy" },
] as const;

export function whatsappSupportUrl(message = "Hi, I need help with Soko") {
  const number = process.env.NEXT_PUBLIC_WHATSAPP_SUPPORT_NUMBER ?? "254700000000";
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}
