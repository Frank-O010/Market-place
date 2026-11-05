# Monitoring and alerts

Errors go to Sentry with personal data collection turned off. On top of errors, the app sends
**security events** to Sentry as messages tagged `security_event:<kind>` (and `action:<name>`),
and writes them (except rate-limit hits) to the audit log at `/admin/audit`.

| Kind                       | When                                                                                                           | Example actions                                                    |
| -------------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `rate_limited`             | Someone hits a rate limit                                                                                      | `signIn`, `checkout`, `message`, `admin`                           |
| `webhook_signature_failed` | A Paystack or Clerk webhook arrives with a bad signature                                                       | `webhook.paystack.bad_signature`, `webhook.clerk.signature_failed` |
| `payment_failed`           | Paystack reports a failed charge                                                                               | `payment.failed`                                                   |
| `payment_mismatch`         | A webhook's amount or currency doesn't match the order (possible tampering)                                    | `payment.verify_mismatch`                                          |
| `admin_action`             | Role, tier, settings, category, payout retry, suspension, staff refund, dispute decision, payout number change | `user.roles.change`, `settings.commission_bps`                     |

## Alert rules to create in Sentry

Create these under Alerts, Create alert, "Number of events in an issue" or "Issue alert", filtered by tag.
Send them to email and, if you use one, a Slack or WhatsApp channel the team reads.

1. **Webhook signature failures:** `security_event` equals `webhook_signature_failed`, more than 5 events in 10 minutes. Someone may be forging payment webhooks, or a secret was rotated without updating the app.
2. **Payment mismatch:** `security_event` equals `payment_mismatch`, any event. Always investigate.
3. **Failed payments spike:** `security_event` equals `payment_failed`, more than 20 events in 1 hour. Usually an M-Pesa or Paystack outage; consider switching checkout off in Admin, Settings.
4. **Rate-limit spike:** `security_event` equals `rate_limited`, more than 100 events in 10 minutes. A bot or brute-force attempt; check the `action` tag, and Cloudflare's WAF.
5. **Role changes:** `security_event` equals `admin_action` and `action` equals `user.roles.change`, any event. Someone gained or lost staff access.
6. **Settings changes:** `security_event` equals `admin_action` and `action` starts with `settings.`, any event.
7. **Payout destination changed:** `action` equals `seller.payout_details.change`, any event. Check it was the seller (account takeover is the main payout fraud).

Failed sign-ins happen inside Clerk, which has its own brute-force protection; review them in the Clerk dashboard (Users, then a user's sessions, or the Attack protection settings).

## Other monitoring

- **Uptime:** add a free uptime check (Better Stack, UptimeRobot or Vercel's) on `/` every 5 minutes (a health endpoint is added in Phase 6).
- **Cron jobs:** Vercel, Project, Cron Jobs shows each run. A failed run also reaches Sentry as an error.
- **Payouts:** Admin, Payouts, filter "Failed". The overview page shows the count.
