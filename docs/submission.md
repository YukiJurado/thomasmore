# Week 3 submission

## Required links

- GitHub project: https://github.com/YukiJurado/thomasmore
- Running project: https://thomasmore-api.onrender.com/
- Health endpoint: https://thomasmore-api.onrender.com/api/health

## Stack Overflow discussions consulted

1. [NodeJS/Express: Cache and 304 status code](https://stackoverflow.com/questions/18811286/nodejs-express-cache-and-304-status-code)

   Used to distinguish HTTP response revalidation from application-side caching. A `304` alone does not show that a database query was avoided. This project instead caches serialized GET responses in memory and exposes `X-Cache` headers. Browser storage is disabled for API responses, while successful writes invalidate the server-side cache.

2. [Nodemailer Ethereal emails are not delivered to Gmail](https://stackoverflow.com/questions/72445846/nodemailer-ethereal-emails-are-not-deliver-to-the-gmail)

   Used when deciding how to verify email sending: a fake SMTP/testing inbox is different from delivery to a real recipient. The tests use a local SMTP receiver for repeatability; the hosted sender requires a real SMTP or HTTPS provider account. A simulated SMTP success is not claimed as proof that an actual inbox received an email.

## Primary technical references

- [Sequelize managed transactions](https://sequelize.org/docs/v6/other-topics/transactions/): commit registration and outbox records together, and roll back on failure.
- [Nodemailer SMTP transport](https://nodemailer.com/smtp): message sending and bounded network timeouts.
- [Resend send-email API](https://resend.com/docs/api-reference/emails/send-email): optional HTTPS sending and idempotency keys.
- [Brevo SMTP setup](https://help.brevo.com/hc/en-us/articles/7924908994450-Send-transactional-emails-using-Brevo-SMTP): live SMTP connection and supported ports.
- [Transactional outbox pattern](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/transactional-outbox.html): save business data and notification intent atomically.
- [Render free-service limitations](https://render.com/docs/free): ephemeral files, sleeping services and blocked SMTP ports.

## Implementation

- Split the backend into routes, controllers, services, repositories, models, configuration and middleware.
- Preserve existing HTTP integration tests and response formats.
- Store a registration and its pending email in one transaction; retry failed delivery in the background.
- Correct the full-capacity boundary and serialize competing last-seat requests.
- Cache successful data GETs; invalidate after successful writes; protect against stale in-flight cache fills.
- Expire cached statistics at the next event start.
- Serve the Vue frontend and Express API together from Render, including browser deep links.

## Validation

`npm run check` passes **49 API tests and 10 frontend tests**, with no lint warnings or errors. `npm run build` passes.

The new tests cover an unavailable mail provider, actual local SMTP messages, outbox rollback, a real process restart, concurrent registration attempts, cache invalidation, expiry, memory bounds and delayed reads. They do not require live mail credentials.

Live frontend/API checks are recorded in [verification.md](verification.md). The live deployment now uses Brevo SMTP. A confirmation to a separately authorized recipient was reported **Delivered** in Brevo after the queued job and registration survived the hosting redeploy. The earlier Resend owner-only sender is no longer the active provider.

## Hosting boundaries

The free Render deployment uses an external Neon PostgreSQL database, so registrations and pending jobs are independent of Render’s temporary filesystem. A real PostgreSQL process-restart check retained both a registration and its unsent email job. Multiple app instances would require a shared cache/invalidation strategy and a corresponding worker concurrency design.

Final audit additionally covers an SMTP server that accepts a connection but never greets, and seeding an empty database after its ID counter has advanced. Both regressions were reproduced before correction.
