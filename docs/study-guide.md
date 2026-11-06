# Backend study guide

Read the source in the order below, then follow a request from its URL to the database and back. Use `git log --oneline` and `git show <commit>` to study each change.

## 1. A browser request travels through layers

```text
GET /api/events/3
  app.mjs mounts eventRoutes at /api/events
  routes/eventRoutes.mjs matches /:id
  middleware/validate.mjs checks params using the Zod idSchema
  controllers/eventController.mjs calls getEventById(3)
  services/eventService.mjs coordinates event lookup and registration count
  repositories query Sequelize models
  controller sends JSON
```

| Layer | It owns | It should not own |
| --- | --- | --- |
| Route | URL, method, validation and controller wiring | Database queries and business rules |
| Controller | HTTP input/output and status codes | Sequelize calls |
| Service | Rules and coordination | Express response objects or Sequelize models |
| Repository | Data queries and transaction details | HTTP status decisions |
| Model | Fields, types and relationships | Request handling |
| Configuration | Environment variables and defaults | Business logic |

A refactor reorganizes code while preserving behavior. New features and bug fixes change behavior and need additional tests.

## 2. Configuration and startup

`config/env.mjs` loads an optional `.env` outside tests and exports the settings. Missing files are allowed; other loading errors are not silently ignored. Positive-number checks reject invalid ports, intervals and TTLs early.

`process.env` is read only in this configuration module. An environment variable is a setting supplied by the operating system or host, not a hard-coded secret in source control.

`db/index.mjs` creates the SQLite connection, defines models, and connects their relationships. `Event.hasMany(Registration)` means one event can own multiple registrations. `Registration.belongsTo(Event)` provides the foreign key to its event. `onDelete: 'CASCADE'` removes dependent records when their parent is deleted. Pending confirmation jobs depend on their registration too.

`server.mjs` syncs tables, seeds an empty database, starts the mail worker and listens on the configured port. Binding to `0.0.0.0` lets the host route incoming traffic to the process. Shutdown stops accepting requests and closes worker/database resources.

`app.mjs` only assembles middleware and routes. Its compatibility exports preserve the original tests while the implementation moves into focused modules.

## 3. Validation

`z.coerce.number().int().positive()` converts the URL string into a number and checks that it is a positive integer.

`validate(schema, source)` returns an Express middleware function. For `source === 'body'` it validates `req.body`; for `params` it validates URL parameters. `safeParse` returns an explicit success or failure rather than throwing.

Successful values are placed in `req.validated`. This keeps controllers from accidentally using unchecked raw input. `next()` continues to the controller; `next(error)` goes to the error handler.

`issues.map(...)` turns Zod's issues into the existing `{ field, message }` error details. `path.join('.')` joins nested field names. `|| source` supplies a fallback when an issue applies to the whole object.

## 4. Controllers and services

The controller's `await` waits for its service promise. `res.json(value)` serializes the result and sends JSON. A normal successful GET defaults to status `200`; creating a resource explicitly returns `201`; deleting returns `204` with no body.

`location('/api/events/' + event.id)` supplies the URL of the new resource in an HTTP response header.

`requireEvent(id)` either returns the event or throws `AppError(404, 'NOT_FOUND', ...)`. The repository returns `null` for missing data; the service decides that this means an event-not-found error.

`getEventById` combines the event with the registration count. `{ ...event, registered, spotsLeft }` copies fields and adds the calculated fields. `Math.max(capacity - registered, 0)` prevents a negative available-seat display.

Statistics use the registration count to calculate an occupancy percentage and choose `full`, `past`, or `open`. The original priority is preserved: a full event remains `full` even when its date has passed.

## 5. Repositories

`Event.findAll` retrieves rows; its order option sorts start dates ascending. `findByPk` retrieves by primary key. `create`, instance `update`, and model `destroy` write changes. `Registration.count({ where: { eventId } })` counts only registrations for that event.

`toJSON()` converts a Sequelize model instance into a plain object so services do not depend on ORM methods.

`options = {}` supplies a default empty options object. Passing `{ transaction }` makes several repository calls participate in the same database transaction. The service does not construct SQL or import Sequelize.

`withDatabase` serializes complete database operations in this single-process SQLite application. Its promise chain runs the next operation after the previous operation settles. Catching rejection on the queue allows future operations to continue after one fails; the original failing promise is still returned to its caller.

`withTransaction` uses Sequelize's managed transaction: return normally to commit, throw to roll back. Public reads also pass through the operation queue, so they cannot observe/cache an incomplete registration transaction.

This simple serialization favors understandable correctness over high throughput. It is not a design for multiple independent servers.

## 6. Why registration survives a broken mail provider

```text
Registration request
  begin database transaction
  check event, duplicate registration and capacity
  save registration
  save EmailJob containing the intended confirmation
  commit both records
  return HTTP 201

Background worker
  load due, unsent EmailJobs
  ask mail provider to send
  success: record sentAt
  failure: increment attempts and schedule retry
```

The transaction contains no email-network call. Provider failure therefore cannot undo an already committed registration. If saving the EmailJob itself fails, the registration is rolled back as well: there is no saved registration with silently lost notification intent.

`count >= capacity` rejects a full event. The starter used `>`, which permitted an extra person at the exact capacity boundary. The transaction queue also prevents two requests from both claiming the final seat.

Each EmailJob stores recipient, subject, text, attempts, next-attempt time, delivery UUID, and optional sent/error fields. Payload snapshots mean later event edits do not unexpectedly change an already queued confirmation.

`createMailWorker` has a `drain` method for one batch and `start` for periodic background processing. A shared `running` promise prevents overlapping batches in this one worker. The interval is unreferenced so it does not keep a shutting-down process alive by itself.

Retry delay doubles after each failure and is capped at one hour. Failed jobs remain in SQLite, and a new worker can find them after restart. Deleting an event cascades through registrations to pending email jobs.

`mail/sender.mjs` supports Nodemailer SMTP and Resend HTTPS. Timeouts bound an unavailable provider call. Resend uses an API key in its authorization header; it is never committed or printed. A provider error rejects the send promise, so the worker records a retry.

A stable UUID prevents different jobs from sharing an idempotency key after a database reset. Resend's key can suppress duplicate requests within its provider window. SMTP receives a stable Message-ID, but this is not a guarantee that a recipient will never receive duplicates. A crash after provider acceptance and before `sentAt` is saved is an unavoidable ambiguity without stronger provider guarantees.

Provider acceptance is not proof of inbox delivery. Real delivery can still bounce, be filtered, or require sender/domain verification. Resend's default test sender is restricted to the account owner's recipient address.

## 7. Caching and invalidation

`responseCache.mjs` uses a Map keyed by the request URL. Each entry has serialized JSON and an expiry time. `MISS` means a controller must load fresh data; `HIT` sends the stored body immediately.

Only successful data GET responses are stored. Health checks bypass the cache, and error responses are not stored. A TTL bounds how long an entry can live. A maximum of 500 entries bounds memory; the oldest inserted entry is evicted when full. This is a simple bounded cache, not an LRU implementation.

POST, PATCH, PUT and DELETE middleware waits for a successful response's `finish` event, then clears the cache. Clearing all keys is conservative but easy to verify for this small app: a registration changes event details, registration lists and statistics.

The generation counter solves a race:

1. An old GET starts reading data.
2. A write completes and invalidates the cache.
3. The old GET finishes later.
4. Because it captured an older generation, it cannot cache its old result.

`res.locals.cacheExpiresAt` gives statistics an earlier deadline when the next event starts. Without this, a cached `open` status could remain after time makes the event `past`, even without any write.

`Cache-Control: no-store` controls browsers and proxies; it does not prevent the application's private Map from caching. This distinction matters when GET endpoints include participant information.

The Map belongs to one Node process. For multiple instances use shared invalidation or a shared cache; TTL alone is not enough to guarantee immediate correctness across instances.

## 8. Errors

`AppError extends Error` creates a custom error class. `super(message)` initializes the standard error message. Its status/code/details supply the expected HTTP error response.

The error middleware has four parameters because Express uses that signature to identify it. Invalid JSON becomes `400 INVALID_JSON`; an AppError preserves its expected status; an unexpected failure is logged and returns a generic `500 INTERNAL_ERROR` without exposing its stack or private provider details.

## 9. Tests and deployment

The original HTTP integration tests remain unchanged. New feature tests check the new behavior instead of weakening existing expectations.

- Offline provider: registration still exists, pending job retries later.
- Outbox failure: registration and job both roll back.
- Restart: a new operating-system process reads the same registration and pending job from the retained SQLite file.
- SMTP: a real local SMTP conversation carries the expected message.
- Capacity/concurrency: only one competing request can take the final seat.
- Cache: hits, invalidation, expiry, bounded size and old in-flight responses.
- Frontend: Vue deep links return HTML and unknown API URLs still return JSON errors.

`npm run check` runs lint and all tests. `npm run build` compiles the Vue app. Render builds from the repository root and runs the API workspace; Express serves both the API and compiled Vue assets from the same origin, so no production CORS configuration is necessary.

Free Render storage is temporary. The restart test proves persistence when the database file remains; it does not overcome the host deleting that file. A persistent disk or managed database is needed to make hosted registrations durable across redeploys.

## Questions to rehearse

1. Which layer queries the database? The repository.
2. Which layer sends JSON and selects HTTP status? The controller.
3. Which layer decides that a full event must reject registration? The service.
4. Why not await email inside the registration transaction? A slow/unavailable external system must not block or roll back the saved registration.
5. Why an outbox instead of only catching a failed email promise? The database also remembers unsent work after a restart.
6. Why clear all cache entries? Several responses depend on the same write; simple broad invalidation avoids missing a dependency.
7. Why is TTL insufficient alone? Responses could remain stale immediately after a successful write.
8. Why does health bypass cache? It must prove the database is reachable now.
9. Is exactly-once email delivery guaranteed? No; explain the provider-acceptance/crash window.
10. Is the free deployment durable? No; explain ephemeral storage and the persistent-storage remedy.
