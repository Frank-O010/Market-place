import { absoluteUrl } from "@/lib/urls";
import { layout, money, type EmailContent } from "./render";

type OrderSummary = {
  id: string;
  number: string;
  items: { titleSnapshot: string; quantity: number; unitPriceMinor: number }[];
  subtotalMinor: number;
  deliveryFeeMinor: number;
  totalMinor: number;
  platformFeeMinor: number;
};

const itemRows = (order: OrderSummary): [string, string][] => [
  ...order.items.map((i): [string, string] => [
    `${i.titleSnapshot} × ${i.quantity}`,
    money(i.unitPriceMinor * i.quantity),
  ]),
  ["Delivery", money(order.deliveryFeeMinor)],
  ["Total paid", money(order.totalMinor)],
];

export function paymentReceipt(order: OrderSummary, sellerName: string): EmailContent {
  return {
    subject: `Receipt for order ${order.number}`,
    ...layout({
      heading: "Thanks, your payment is held safely",
      paragraphs: [
        `We've received your payment for order ${order.number} from ${sellerName}.`,
        "We hold the money until you confirm the item arrived, so you're protected if anything goes wrong.",
      ],
      rows: itemRows(order),
      action: { label: "Track your order", url: absoluteUrl(`/account/orders/${order.id}`) },
    }),
  };
}

export function newOrderForSeller(order: OrderSummary): EmailContent {
  return {
    subject: `New paid order ${order.number}`,
    ...layout({
      heading: "You have a new order",
      paragraphs: [
        `Order ${order.number} is paid. The money is held safely and released to you when the buyer confirms delivery.`,
        "Please prepare the item and mark it as shipped.",
      ],
      rows: [
        ...order.items.map((i): [string, string] => [
          `${i.titleSnapshot} × ${i.quantity}`,
          money(i.unitPriceMinor * i.quantity),
        ]),
        ["You'll receive", money(order.totalMinor - order.platformFeeMinor)],
      ],
      action: { label: "Open the order", url: absoluteUrl(`/sell/orders/${order.id}`) },
    }),
  };
}

export function orderShipped(order: OrderSummary, note: string | null, autoReleaseDays: number): EmailContent {
  return {
    subject: `Order ${order.number} is on the way`,
    ...layout({
      heading: "Your order is on the way",
      paragraphs: [
        ...(note ? [`Note from the seller: ${note}`] : []),
        "When it arrives, check it and tap “I received it” so the seller gets paid.",
        `If there's a problem, report it within ${autoReleaseDays} days. After that the payment is released to the seller automatically.`,
      ],
      action: { label: "View the order", url: absoluteUrl(`/account/orders/${order.id}`) },
    }),
  };
}

export function fundsReleased(order: OrderSummary, automatic: boolean): EmailContent {
  return {
    subject: `Payment released for order ${order.number}`,
    ...layout({
      heading: "Your payment is on its way",
      paragraphs: [
        automatic
          ? `The confirmation period for order ${order.number} has ended, so we've released your payment.`
          : `The buyer confirmed they received order ${order.number}.`,
        "We're sending the money to your M-Pesa now.",
      ],
      rows: [
        ["Order total", money(order.totalMinor)],
        ["Commission", money(order.platformFeeMinor)],
        ["Payout", money(order.totalMinor - order.platformFeeMinor)],
      ],
      action: { label: "See payouts", url: absoluteUrl("/sell/payouts") },
    }),
  };
}

export function orderCancelled(order: OrderSummary, refunded: boolean, reason: string): EmailContent {
  return {
    subject: `Order ${order.number} was cancelled`,
    ...layout({
      heading: "Your order was cancelled",
      paragraphs: [
        reason,
        refunded
          ? `We've refunded ${money(order.totalMinor)}. Refunds usually arrive within 1 to 5 working days.`
          : "You haven't been charged.",
      ],
      action: { label: "View the order", url: absoluteUrl(`/account/orders/${order.id}`) },
    }),
  };
}

export function latePaymentRefunded(reference: string, amountMinor: number): EmailContent {
  return {
    subject: "We've refunded your payment",
    ...layout({
      heading: "Your payment was refunded",
      paragraphs: [
        `A payment of ${money(amountMinor)} (reference ${reference}) arrived after the order had closed, so we've refunded it in full.`,
      ],
    }),
  };
}
