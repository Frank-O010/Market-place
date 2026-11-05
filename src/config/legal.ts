/**
 * Draft legal text. Written to match how the app actually works, so a lawyer has something
 * concrete to review, but NOT legal advice and NOT reviewed. Every page shows a "draft" notice
 * until LEGAL_REVIEWED is set to true after a Kenyan lawyer has signed the text off.
 * Placeholders in [brackets] must be filled in before launch.
 */
export const LEGAL_REVIEWED = false;
export const LEGAL_UPDATED = "5 November 2026";

type Section = { heading: string; paragraphs: string[] };

const operator =
  "[Company name], a company registered in Kenya (registration number [number]), of [registered address], Nairobi";
const contact = "[support email] or WhatsApp [support number]";

export const legalContent: Record<string, Section[]> = {
  terms: [
    {
      heading: "Who we are",
      paragraphs: [
        `Soko is a marketplace run by ${operator} ("we", "us"). Soko lets people in Kenya list items for sale and buy items from other people. Soko is not the seller of the items listed, unless a listing says so.`,
        "By creating an account or buying through Soko you agree to these terms. If you don't agree, please don't use Soko.",
      ],
    },
    {
      heading: "Your account",
      paragraphs: [
        "You must be at least 18 years old, or have a parent's or guardian's permission, to use Soko. Give us true details and keep your sign-in details private. You're responsible for what happens on your account.",
        "We may suspend or close accounts that break these terms, that we reasonably believe are being used for fraud, or when the law requires it. Staff accounts must use two-step verification.",
      ],
    },
    {
      heading: "Buying",
      paragraphs: [
        "Prices are in Kenyan shillings and include any delivery fee shown at checkout. You pay through Soko by M-Pesa or card, handled by our payment provider, Paystack. We never see or store your card number.",
        "After you pay, we hold the money until you confirm you received the item, or until the confirmation window ends after the seller marks it as sent (currently [3] days). If something is wrong, report a problem before then and the money stays held while we look into it. See the Refund and dispute policy.",
        "Arranging payment outside Soko (for example sending M-Pesa straight to a seller) is at your own risk: we can't protect or refund those payments.",
      ],
    },
    {
      heading: "Selling",
      paragraphs: [
        "Sellers must also accept the Seller agreement. Listings must be accurate, for items you own and are allowed to sell, and must not include anything on the Prohibited items list.",
      ],
    },
    {
      heading: "Messages, reviews and reports",
      paragraphs: [
        "Be honest and respectful. Don't post anything unlawful, abusive or misleading, or other people's personal details. Reviews must be about a real purchase. We may hide messages, reviews or listings that break these rules, and we act on reports from users.",
      ],
    },
    {
      heading: "Our responsibility",
      paragraphs: [
        "We work hard to keep Soko safe, but sellers, not Soko, are responsible for the items they sell. To the extent the law allows, we are not liable for indirect losses, and our total liability for any order is limited to the amount paid for that order. Nothing in these terms limits your rights under the Consumer Protection Act, 2012 or other Kenyan law.",
      ],
    },
    {
      heading: "Changes and the law",
      paragraphs: [
        "We may update these terms; we'll tell you about important changes before they apply. These terms are governed by the laws of Kenya, and the courts of Kenya have jurisdiction.",
        `Questions: ${contact}.`,
      ],
    },
  ],
  "seller-agreement": [
    {
      heading: "Listing items",
      paragraphs: [
        "Describe items honestly, including their condition and any faults, and use your own photos. Keep stock levels up to date. A moderator may check your first listing, and any listing that mentions a possibly prohibited item, before it goes live.",
      ],
    },
    {
      heading: "Fees",
      paragraphs: [
        "Listing is free. When an item sells, Soko keeps a commission of [10]% of the order total, which is shown to you on each order before you send the item. We may change the commission with at least 14 days' notice; changes apply only to new orders.",
      ],
    },
    {
      heading: "Sending orders and getting paid",
      paragraphs: [
        "Send or hand over paid orders promptly and mark them as sent in Soko. You're paid by M-Pesa, through Paystack, after the buyer confirms delivery or the confirmation window ends without a dispute. Payouts may be held while a problem is investigated, or if an order is flagged by our safety checks.",
        "Don't ask buyers to pay you outside Soko. Doing so may lead to your account being suspended.",
      ],
    },
    {
      heading: "Refunds and disputes",
      paragraphs: [
        "If a buyer reports a problem, respond in Soko within [3] days. You can refund in full at any time. Otherwise a moderator decides based on the evidence: a full refund, a partial refund (taken from your share of the sale), or release of the payment to you.",
      ],
    },
    {
      heading: "Verification and taxes",
      paragraphs: [
        "We may ask you to verify your identity with a photo of your national ID or passport. We store it privately and use it only to verify you (see the Privacy policy). You're responsible for any taxes and licences that apply to your sales.",
      ],
    },
  ],
  "prohibited-items": [
    {
      heading: "You can't sell",
      paragraphs: [
        "Weapons, ammunition and explosives; illegal drugs and drug paraphernalia; prescription medicines; alcohol and tobacco; counterfeit or replica goods; stolen goods; wildlife products, including ivory and rhino horn; human remains or body parts; hazardous materials; recalled products; anything that infringes someone's copyright or trademark; adult content; government documents, IDs and SIM cards; financial products, gift cards and money; services; and anything else that is illegal to sell in Kenya.",
      ],
    },
    {
      heading: "What happens",
      paragraphs: [
        "Listings that mention these items are checked by a moderator before they go live. Listings that break this policy are removed, and repeated or serious breaches lead to account suspension and, where required, a report to the authorities.",
        "Not sure if something is allowed? Ask us first: " + contact + ".",
      ],
    },
  ],
  privacy: [
    {
      heading: "Who is responsible for your data",
      paragraphs: [
        `${operator} is the data controller for personal data processed through Soko, registered with the Office of the Data Protection Commissioner under registration number [ODPC number]. Contact our data protection lead at [privacy email].`,
      ],
    },
    {
      heading: "What we collect and why",
      paragraphs: [
        "Account details (name, email, phone number) to run your account and send order updates. Order details (items, delivery area and directions, phone number for M-Pesa) to complete orders; sellers see a buyer's phone number and address only after payment. Messages, reviews and reports to run the marketplace and keep it safe. For sellers: shop details, an M-Pesa payout number (stored by Paystack; we keep only a masked version) and, if you choose to verify, a photo of your ID.",
        "Technical data (IP address, device and browser) to keep Soko secure, stop abuse and fix errors. If you accept analytics cookies, we also record which pages and steps you use, to improve Soko.",
        "Our lawful bases are performing our contract with you, our legitimate interests in running a safe marketplace, legal obligations (for example keeping financial records), and your consent for analytics.",
      ],
    },
    {
      heading: "Who we share it with",
      paragraphs: [
        "Service providers who process data for us: Clerk (sign-in), Paystack (payments and payouts), Vercel and our database host (hosting), Cloudflare (photo storage and security), Resend (email), Africa's Talking (SMS), Sentry (error reports, without personal content) and, with your consent, PostHog EU (analytics). Some of them store data outside Kenya; we use contracts with safeguards required by the Data Protection Act, 2019.",
        "The other party to your order sees what they need to complete it. We share data with authorities only when the law requires. We never sell your data.",
      ],
    },
    {
      heading: "How long we keep it",
      paragraphs: [
        "While your account is open. When you delete it, we erase your name, email and phone straight away and remove what's left (messages, review text, addresses, ID photos) after 30 days. Orders and payment records are kept without your personal details for [5] years, as Kenyan tax law requires. Rejected ID photos are deleted immediately.",
      ],
    },
    {
      heading: "Your rights",
      paragraphs: [
        "You can access your data (Account, then Privacy, then Download my data), correct it, object to or restrict some processing, withdraw analytics consent at any time, and delete your account. You can also complain to the Office of the Data Protection Commissioner (www.odpc.go.ke).",
      ],
    },
  ],
  cookies: [
    {
      heading: "Essential cookies",
      paragraphs: [
        "These keep you signed in, protect your account (for example the security check on sign-in) and remember your cookie choice. Soko can't work without them, so they don't need consent.",
      ],
    },
    {
      heading: "Analytics (only with your consent)",
      paragraphs: [
        "If you accept analytics, we set a cookie with a random ID so we can count visits and see where people get stuck, for example how many searches lead to a purchase. Events go through our own server to PostHog's EU servers; no advertising or tracking scripts run on Soko. We don't use advertising cookies.",
        "You can change your choice any time in Account, then Privacy, or by clearing your cookies.",
      ],
    },
  ],
  "refunds-and-disputes": [
    {
      heading: "Your payment is held until you're happy",
      paragraphs: [
        "When you pay, the money is held by Soko, not sent to the seller. It's released when you confirm you received the item, or automatically [3] days after the seller marks it as sent if you haven't reported a problem.",
      ],
    },
    {
      heading: "If something goes wrong",
      paragraphs: [
        "Open your order and tap Report a problem: the item didn't arrive, isn't as described, or is damaged. Add photos if you can. The money stays held. The seller can reply or refund you; if you can't agree, a Soko moderator decides, usually within [3] working days.",
        "Outcomes are a full refund, a partial refund, or release to the seller. Refunds go back to the M-Pesa number or card you paid with, usually within [5] working days depending on your provider.",
      ],
    },
    {
      heading: "Cancellations",
      paragraphs: [
        "You can cancel an order before you pay. A seller can cancel a paid order before sending it, and you're refunded in full. Unpaid orders are cancelled automatically when the payment time runs out.",
      ],
    },
    {
      heading: "Not covered",
      paragraphs: [
        "Payments made outside Soko, changes of mind after you've received an item as described (unless the seller agrees), and problems reported after the money has been released.",
      ],
    },
  ],
};
