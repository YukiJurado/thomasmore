# Verification record

Checked on 6 November 2026. No existing integration tests were edited.

## Automated checks

- `npm run check`: ESLint passes with no warnings; 40 API tests and 10 frontend tests pass.
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

## Remaining external conditions

A live registration confirmation was sent through the configured Resend HTTPS provider. The provider dashboard reported **Delivered** for subject `Registration confirmed: Week 3 email verification`. The temporary test event and registration were removed afterward. Private recipient details and the API key are not included in this repository.

The Resend test sender is restricted to the account owner's address. Arbitrary recipients require a verified sending domain.

GitHub CI also passed lint, all 50 tests and the production build: https://github.com/YukiJurado/thomasmore/actions/runs/42298723521

Free Render's temporary filesystem is not durable production storage. The restart test uses a retained SQLite file; it does not claim that Render retains discarded files. A persistent disk or managed database is needed for that guarantee.
