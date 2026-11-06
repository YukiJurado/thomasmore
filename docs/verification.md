# Verification record

Checked on 6 November 2026. No existing integration tests were edited.

## Automated checks

- `npm run check`: ESLint passes with no warnings; 49 API tests and 10 frontend tests pass.
- `npm run build`: Vue production build succeeds.
- Local SMTP transport, unavailable provider, retry backoff, transaction rollback and actual process-restart persistence are covered by feature tests.
- Cache feature tests cover successful writes, failed writes, errors, TTL, memory bound, statistics time boundaries and stale in-flight reads.

## Live Render checks

URL: https://thomasmore-api.onrender.com/

The deployed frontend returns HTML and renders its event list in a real browser. Direct navigation to `/events/1` also renders the detail page. The Render dashboard showed commit `0ab2bcb` live after the configured build completed.

These HTTP requests ran against the hosted API using a temporary verification event. The temporary event, registration and queued email were deleted afterward; the original demo events were retained.

| Method | Path | Status | Cache |
| --- | --- | --- | --- |
| GET | `/api/health` | 200 | bypass / write |
| POST | `/api/events` | 201 | bypass / write |
| GET | `/api/events/5` | 200 | MISS |
| GET | `/api/events/5` | 200 | HIT |
| GET | `/api/stats` | 200 | MISS |
| GET | `/api/events/5/registrations` | 200 | MISS |
| POST | `/api/events/5/registrations` | 201 | bypass / write |
| GET | `/api/events/5` | 200 | MISS |
| GET | `/api/events/5/registrations` | 200 | MISS |
| POST | `/api/events/5/registrations` | 409 | bypass / write |
| PATCH | `/api/events/5` | 200 | bypass / write |
| GET | `/api/events/5` | 200 | MISS |
| DELETE | `/api/events/5` | 204 | bypass / write |
| GET | `/api/events/5` | 404 | MISS |
| GET | `/api/events/5` | 404 | MISS |
| GET | `/api/events/not-an-id` | 400 | MISS |

The registered event reported one participant and zero remaining seats. A second participant was rejected as full. Updating its title invalidated the cache. Deleting it yielded JSON 404s on subsequent reads, and those errors were not cached.

## Email and durable hosting verification

A live registration confirmation was sent through the configured Resend HTTPS provider. The provider dashboard reported **Delivered** for subject `Registration confirmed: Week 3 email verification`. The temporary test event and registration were removed afterward. Private recipient details and the API key are not included in this repository.

The live provider has since switched to Brevo SMTP on port 2525. Its credential authenticated over verified TLS. A separately authorized test recipient was registered while the old provider rejected delivery: the registration and unsent job remained stored. After the Render redeploy, the worker accepted the same queued job through the new provider and cleared its error. No additional confirmation was created. Brevo’s transactional log then reported **Delivered** for that subject and the authorized recipient. The recipient had not yet located it in the Mail app; the delivery log does not establish Inbox versus Junk placement. Private delivery screenshots remain outside Git.

GitHub CI passed lint, tests and the production build at the earlier verified checkpoint: https://github.com/YukiJurado/thomasmore/actions/runs/42298723521

The live application now reads an external Neon PostgreSQL database. Four existing events and three registrations were imported without resending historical email. A separate real PostgreSQL check committed a registration and pending email, closed the process, and verified both from a fresh process. Disposable verification records were removed. Local automated restart tests continue to use retained SQLite files.

Final audit additionally covers an SMTP server that accepts a connection but never greets, and seeding an empty database after its ID counter has advanced. Both regressions were reproduced before correction.

PostgreSQL implementation CI passed lint, all 59 tests, and the production build: https://github.com/YukiJurado/thomasmore/actions/runs/42305048089

Final audit: 26 live HTTP assertions passed, covering HTML/deep links, health, JSON errors, validation, event creation/update/deletion, registration listing, statistics, cache hits, browser no-store, and invalidation. The disposable audit event was deleted. The existing integration-test directory is unchanged from the starter commit. A scan of 95 tracked text files found no live database or SMTP credentials.

CI also passed for `66b6bab`: https://github.com/YukiJurado/thomasmore/actions/runs/42307873043
