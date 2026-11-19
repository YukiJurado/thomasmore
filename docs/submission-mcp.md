# MCP and live notifications assignment

## Submission links

- GitHub: https://github.com/YukiJurado/thomasmore
- Working application: https://thomasmore-api.onrender.com/

For MCP testing, connect an MCP-capable AI client to:
https://thomasmore-api.onrender.com/mcp

## Implemented behavior

- MCP tools list upcoming events, list past events and register one person for an event.
- MCP and REST use the same registration rules and transactional email outbox.
- Every connected browser receives a toast after event creation or successful registration.
- Notification payloads contain no participant name or email; each page shows one toast per notification ID.
- Cache invalidation targets affected resources and also applies to MCP writes.

## Validation

- `npm run check`: lint, 65 API tests and 15 frontend tests.
- `npm run build`: production frontend build.
- Official MCP client tests over HTTP, including modern and legacy protocol negotiation.
- Two simultaneous SSE connection tests, rollback/privacy checks and a REST-versus-MCP last-seat race.
- Browser verification using two open pages: event creation and MCP registration each appeared once in both.

Connection instructions and demo steps: [MCP and notification API](mcp-notifications.md).
Free Render may take longer on the first request after sleeping. Notifications are
live-only while a page is connected; the deployment uses one application process.
