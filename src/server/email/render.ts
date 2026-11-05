import { site } from "@/config/site";
import { formatKes } from "@/lib/money";

/** Minimal, safe HTML email building. Every dynamic value goes through esc(). */
export const esc = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

export type EmailContent = { subject: string; html: string; text: string };

export function layout(input: {
  heading: string;
  paragraphs: string[];
  rows?: [string, string][];
  action?: { label: string; url: string };
}): { html: string; text: string } {
  const rows = input.rows ?? [];
  const html = `<!doctype html><html><body style="margin:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#111827">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border-radius:8px;padding:24px">
<tr><td style="font-size:20px;font-weight:bold;color:#0F766E;padding-bottom:12px">${esc(site.name)}</td></tr>
<tr><td style="font-size:20px;font-weight:bold;padding-bottom:12px">${esc(input.heading)}</td></tr>
${input.paragraphs.map((p) => `<tr><td style="font-size:16px;line-height:24px;padding-bottom:12px">${esc(p)}</td></tr>`).join("")}
${
  rows.length
    ? `<tr><td><table role="presentation" width="100%" style="border-collapse:collapse;font-size:15px">${rows
        .map(
          ([k, v]) =>
            `<tr><td style="padding:6px 0;border-bottom:1px solid #e5e7eb;color:#4b5563">${esc(k)}</td><td align="right" style="padding:6px 0;border-bottom:1px solid #e5e7eb">${esc(v)}</td></tr>`,
        )
        .join("")}</table></td></tr>`
    : ""
}
${
  input.action
    ? `<tr><td style="padding-top:16px"><a href="${esc(input.action.url)}" style="display:inline-block;background:#0F766E;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:6px;font-weight:bold">${esc(input.action.label)}</a></td></tr>`
    : ""
}
<tr><td style="font-size:13px;color:#6b7280;padding-top:24px">${esc(site.description)}</td></tr>
</table></td></tr></table></body></html>`;
  const text = [
    input.heading,
    "",
    ...input.paragraphs,
    "",
    ...rows.map(([k, v]) => `${k}: ${v}`),
    ...(input.action ? ["", `${input.action.label}: ${input.action.url}`] : []),
  ].join("\n");
  return { html, text };
}

export const money = formatKes;
