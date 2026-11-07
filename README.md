# Campus Events — Week 3 backend improvements

Students browse campus events and register for them. Based on the [course starter](https://github.com/JelleOosterboschThomasMore/campus-events).

- **Repository:** https://github.com/YukiJurado/thomasmore
- **Online app:** https://thomasmore-api.onrender.com/
- **Health:** https://thomasmore-api.onrender.com/api/health
- **Submission and sources:** [docs/submission.md](docs/submission.md)

## Run locally

Use Node.js 22.12 or newer. From the repository root:

```bash
npm ci
npm run dev
```

Frontend: http://localhost:5173. API: http://localhost:3000/api.

To run the production layout locally:

```bash
npm run build
npm start -w api
```

The API serves the built Vue app at http://localhost:3000/ and handles deep links such as `/events/1`.

```bash
npm run check  # ESLint, API tests, frontend tests
npm run build # production frontend build
```

`npm run seed` explicitly resets the local database. Do not use it against data you need to keep.

## Backend structure

```text
api/src/
  app.mjs           assembles the Express application
  server.mjs        database startup, HTTP listener, email worker, shutdown
  config/           environment settings and logger
  routes/           URLs, HTTP methods, validation and controller wiring
  validation/       Zod schemas
  middleware/       validation, request logs, errors and frontend serving
  controllers/      HTTP request/response handling
  services/         business rules and operation coordination
  repositories/     database access and transaction boundary
  models/           Sequelize table definitions
  db/               connection and model relationships
  mail/             SMTP / HTTPS provider adapter
  cache/            bounded response cache
```

Services do not import Express or Sequelize. Only repositories query models. Model creation and relationships stay in `db/`. Only `config/env.mjs` reads environment variables.

## Reliable confirmation emails

Registration checks the event, duplicate email and remaining capacity. A transaction inserts **both the registration and an email job**. The endpoint returns `201` after committing, without waiting for an external email provider.

The worker sends pending jobs in the background. On failure the registration remains saved, and the job is retried with exponential backoff, capped at one hour. A newly started worker loads pending jobs from the database. Failed provider calls never become successful deliveries in the queue.

Copy `api/.env.example` to `api/.env` locally, or configure variables directly in the hosting dashboard. Set `MAIL_FROM` and one of:

- `RESEND_API_KEY`: HTTPS delivery through Resend; appropriate for free Render instances that block SMTP ports.
- `SMTP_URL`: delivery through a real SMTP provider or a local test SMTP server.

Set `MAIL_PROVIDER=smtp` or `MAIL_PROVIDER=resend` to select explicitly when both credentials are present.

The live deployment uses Brevo SMTP on port 2525 with `MAIL_PROVIDER=smtp`. Brevo reported a live confirmation as Delivered for an authorized recipient different from the provider signup address. Provider sender verification is still required. Resend remains an optional adapter; its `onboarding@resend.dev` test sender restricts recipients. Tests use a local SMTP receiver and require no provider credentials.

An outbox job has a stable UUID. Resend receives it as an idempotency key; SMTP receives a stable Message-ID. Delivery is **at least once**, not a promise of exactly-once inbox receipt: a crash after provider acceptance but before marking the job sent can cause a retry. Resend's idempotency window is limited; SMTP Message-ID alone does not guarantee deduplication.

## Correct GET caching

Event lists, details, registration lists and statistics use a server-side Map with a 30-second default TTL and a maximum of 500 entries. `X-Cache: MISS` / `HIT` makes behaviour observable. Health checks always query the database and bypass the cache.

Every successful POST, PATCH, PUT or DELETE clears all entries. Clearing everything is deliberately simple: registrations affect counts, remaining seats and statistics across several URLs. Failed writes do not invalidate valid cached data. A generation counter prevents a read started before a change from later refilling the cache with stale data.

Statistics expire no later than the next event start, because time alone can change their status. API responses use `Cache-Control: no-store` so browser caches do not retain registration data; the application's internal Map can still cache responses.

The cache and database-operation queue are designed for **one application process**. Multiple instances would require shared cache invalidation and a database concurrency design suitable for that deployment.

## Deployment

The existing Render web service uses branch `main` and an empty Root Directory:

| Setting | Value |
| --- | --- |
| Build Command | `npm ci --include=dev && npm run build` |
| Start Command | `npm start -w api` |
| Health Check Path | `/api/health` |

`render.yaml` documents the same configuration. The approved PostgreSQL drivers are `pg` and `pg-hstore`.

**Durable storage:** the live app uses an external Neon PostgreSQL database through a private `DATABASE_URL`. `REQUIRE_DURABLE_STORAGE=true` prevents startup from falling back to temporary SQLite files. Local tests still use SQLite. See [PostgreSQL setup and data import](docs/postgresql.md). No paid plan is provisioned.

Free Render also sleeps when idle; the first request can take about a minute. The email worker runs only while the service is awake. Pending jobs resume when it wakes from the external database.

## API

| Method | URL | Purpose |
| --- | --- | --- |
| GET | `/api/health` | Fresh database health check |
| GET / POST | `/api/events` | List / create events |
| GET / PATCH / DELETE | `/api/events/:id` | Read / update / delete an event |
| GET / POST | `/api/events/:id/registrations` | List registrations / register |
| GET | `/api/stats` | Occupancy and status |

Errors retain `{ "error": { "code", "message", "details?" } }`. The starter has no authentication or administrative access control; do not use this demo for sensitive participant data.
