# Durable hosting with PostgreSQL

Local development and tests use SQLite. Setting `DATABASE_URL` selects PostgreSQL;
setting `REQUIRE_DURABLE_STORAGE=true` makes startup fail if that URL is missing.
This prevents a hosted instance from silently falling back to temporary local files.
Connections require verified TLS. Keep the real URL in Render's environment settings,
never in Git or a submission document.

Before switching an existing deployment, run this once from `api/` with a private
environment file containing the target `DATABASE_URL`:

```sh
node --env-file=/absolute/path/to/private.env scripts/importExistingData.mjs
```

The importer reads the existing coursework deployment, preserves event and registration
IDs, and refuses to overwrite a nonempty target database. It imports both tables in
one transaction and advances PostgreSQL ID sequences. Historical confirmations are
not resent. Pending jobs in the old database are not accessible through the public
API and are not imported by this script.

For a new deployment, start with an empty PostgreSQL database and let startup create
the tables and demo events. Do not run the importer after demo seeding.

The coursework deployment still uses one application process. Its response cache and
email worker are local to that process. PostgreSQL row locks protect concurrent
registrations for an event, but multiple application instances would also need shared
cache invalidation and an email-job claiming mechanism.

`MAIL_PROVIDER=smtp` explicitly selects SMTP even if a previous `RESEND_API_KEY`
remains configured. Provider account activation and sender verification still need
to be completed outside the application.
