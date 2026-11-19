# MCP API and browser notifications

The existing REST API remains available. The same services now also power an MCP
endpoint and anonymous browser notifications.

## Connect an AI client

In an MCP-capable AI client, add a remote server using **Streamable HTTP**:

- Hosted endpoint: `https://thomasmore-api.onrender.com/mcp`
- Local endpoint: `http://localhost:3000/mcp`

Configuration field names depend on the client. A normal browser address bar is
not an MCP client: connect the endpoint in the client's MCP/tool settings first.
The application does not need an AI-provider API key; the client supplies the AI
model and chooses the advertised tools from the user's request.

Try these prompts after connecting:

- "Get me all upcoming events."
- "Get me all past events."
- "Register [name], using [their authorized email], for [event title]."

The assistant should first list events to resolve a title to an ID, ask about
ambiguous names, and ask for a missing name/email rather than inventing one.
Registration is a real write and queues a real confirmation email.

## Tools

| Tool | Arguments | Result |
| --- | --- | --- |
| `get_upcoming_events` | `{}` | Events with `startsAt >=` server time, ascending by start |
| `get_past_events` | `{}` | Events with `startsAt <` server time, ascending by start |
| `register_for_event` | `eventId`, `name`, `email` | Registration ID and event ID, or a tool error |

The start-time boundary has no gap or overlap. "Past" is based on `startsAt`,
since the model has no end-time field. Registration reuses the existing duplicate,
capacity and transactional email-outbox rules. A failed registration emits no
notification. Email sending still occurs outside the registration transaction.

The official v2 server and Node adapter serve a fresh MCP instance per request.
Modern protocol negotiation and legacy MCP hosts are both covered by tests.
Host and Origin validation allow localhost and the coursework hostname by default.
`MCP_ALLOWED_HOSTS` and `MCP_ALLOWED_ORIGINS` accept comma-separated hostnames if
the deployment/client hostname changes. A missing Origin is permitted for normal
non-browser MCP clients. These checks are not user authentication; this coursework
demo retains the starter's public access policy.

## Anonymous browser notifications

Every frontend page mounts one global notification component outside RouterView.
It opens one native `EventSource` connection to `GET /api/notifications` and keeps
it while navigating. All connected pages receive:

| SSE event | Toast |
| --- | --- |
| `event.created` | A new event was created. |
| `registration.created` | Someone registered for an event. |

The SSE `id` is a random notification UUID. JSON `data` contains only `eventId`.
Participant names, email addresses and registration objects are never broadcast.
Each page deduplicates notification IDs and displays a dismissible toast for eight
seconds. Different registrations have different IDs, so they remain separate
notifications. The initiating page uses the same stream as every other page;
there is no extra local registration toast.

An application change is published only after its transaction commits and before
the next queued read can start. Both REST and MCP mutations use that path. The
email worker's delivery/retry writes do not publish registration notifications.

SSE bypasses JSON caching. Heartbeat comments keep idle connections active without
producing toasts. Disconnects remove clients/timers; shutdown closes streams. Slow
or broken connections cannot fail an already committed registration.

Notifications are live-only, with automatic browser reconnection and no history
replay. Cache, operation queue and notification fan-out belong to one process.
Multiple application instances would require shared invalidation and a broker.

## Targeted cache invalidation

| Committed mutation | Invalidated resources | Preserved examples |
| --- | --- | --- |
| Event creation | Lists, stats | Existing event details/registrations |
| Update event A | Lists, stats, A details | B details, A/B registration lists |
| Delete event A | Lists, stats, A details/registrations | B details/registrations |
| Register for A | Stats, A details/registrations | Event list, B details/registrations |

List responses currently contain event fields without participant counts. All
query variants and equivalent validated numeric event IDs share a resource tag.
Invalidation also cancels affected in-flight cache fills, leaving unrelated fills
alone. Aborted reads cannot later refill the cache. Full cache clearing is kept
for test/reset operations, not ordinary writes.

## Repeatable verification

```sh
npm run check
npm run build
npm run mcp:check -w api -- http://localhost:3000/mcp
npm run mcp:check -w api -- https://thomasmore-api.onrender.com/mcp
```

The smoke command only discovers tools and reads event lists; it sends no email.
Automated tests use the official MCP client over actual HTTP, two SSE connections,
and component tests for privacy and duplicate suppression. They cover modern and
legacy clients, invalid input, exact date boundaries, a last-seat race between MCP
and REST, rollback, cross-interface cache invalidation and disconnect cleanup.

For a manual demo, open two browser windows on the app. Create a disposable event
in one window and check for one creation toast in each. Register once through the
website or a connected AI client using an authorized recipient, then check for one
anonymous registration toast in each window. Inspect network headers for targeted
cache preservation. Delete only the disposable event afterward.

## Protocol references

- [Official MCP HTTP serving guide](https://ts.sdk.modelcontextprotocol.io/v2/serving/http.html)
- [Node/Express integration](https://ts.sdk.modelcontextprotocol.io/v2/serving/express.html)
- [Official MCP client](https://ts.sdk.modelcontextprotocol.io/v2/clients/connect.html)
