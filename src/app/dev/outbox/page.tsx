import { Suspense } from "react";
import type { Metadata } from "next";
import { db } from "@/server/db";

export const metadata: Metadata = { title: "Email outbox", robots: { index: false } };

/** Dev only (the /dev area 404s in production): every email the app tried to send. */
export default function OutboxPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Email outbox</h1>
      <Suspense>
        <Outbox />
      </Suspense>
    </div>
  );
}

async function Outbox() {
  const messages = await db.emailMessage.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { id: true, to: true, subject: true, text: true, status: true, createdAt: true },
  });
  if (messages.length === 0) return <p className="text-muted">No emails yet.</p>;
  return (
    <ul className="flex flex-col gap-3">
      {messages.map((m) => (
        <li key={m.id} className="border-border rounded-lg border p-3">
          <details>
            <summary className="cursor-pointer">
              <strong>{m.subject}</strong> to {m.to} ({m.status.toLowerCase()})
            </summary>
            <pre className="mt-2 text-sm whitespace-pre-wrap">{m.text}</pre>
          </details>
        </li>
      ))}
    </ul>
  );
}
