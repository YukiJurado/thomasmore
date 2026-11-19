import { createMcpHandler, McpServer } from '@modelcontextprotocol/server';
import { toNodeHandler, hostHeaderValidation, originValidation } from '@modelcontextprotocol/node';
import { z } from 'zod';
import { env } from '../config/env.mjs';
import { logger } from '../config/logger.mjs';
import { AppError } from '../errors/AppError.mjs';
import { listUpcomingEvents, listPastEvents } from '../services/eventService.mjs';
import { register } from '../services/registrationService.mjs';
import { idSchema, registrationSchema } from '../validation/schemas.mjs';

async function toolResult(work) {
  try {
    const value = await work();
    return { content: [{ type: 'text', text: JSON.stringify(value) }], structuredContent: value };
  } catch (error) {
    const expected = error instanceof AppError;
    if (!expected) logger.error('MCP tool failed');
    const value = { error: {
      code: expected ? error.code : 'INTERNAL_ERROR',
      message: expected ? error.message : 'Something went wrong'
    } };
    return { isError: true, content: [{ type: 'text', text: JSON.stringify(value) }], structuredContent: value };
  }
}

export function createEventsMcpServer() {
  const server = new McpServer({ name: 'campus-events', version: '2.0.0' }, {
    instructions: 'List events to resolve a title to its eventId. Ask for clarification when titles are ambiguous. '
      + 'Register only when the user requests it and provides their name and email. Never invent an email address. '
      + 'Upcoming means startsAt is at or after the current server time; past means before it.'
  });
  const readOnly = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
  server.registerTool('get_upcoming_events', {
    description: 'Get all upcoming campus events, ordered by start time, with IDs for registration.',
    inputSchema: z.object({}), annotations: readOnly
  }, () => toolResult(async () => ({ events: await listUpcomingEvents() })));
  server.registerTool('get_past_events', {
    description: 'Get all past campus events, ordered by start time.',
    inputSchema: z.object({}), annotations: readOnly
  }, () => toolResult(async () => ({ events: await listPastEvents() })));
  server.registerTool('register_for_event', {
    description: 'Register one person for an event using eventId, their name and email. '
      + 'Saves their registration and queues a confirmation email. Duplicate or full events are rejected.',
    inputSchema: registrationSchema.extend({ eventId: idSchema.shape.id }),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true }
  }, ({ eventId, name, email }) => toolResult(async () => {
    const saved = await register(eventId, { name, email });
    return { registration: { id: saved.id, eventId: saved.eventId }, message: 'Registration saved; confirmation email queued.' };
  }));
  return server;
}

export function createMcpEndpoint() {
  // A fresh MCP server per request prevents state or responses leaking between clients.
  const handler = createMcpHandler(createEventsMcpServer);
  const nodeHandler = toNodeHandler({
    async fetch(request, options) {
      const response = await handler.fetch(request, options);
      // The transport supplies its own headers; apply this after it builds the response.
      response.headers.set('Cache-Control', 'no-store');
      return response;
    }
  });
  const validateHost = hostHeaderValidation(env.mcpAllowedHosts);
  const validateOrigin = originValidation(env.mcpAllowedOrigins);
  return {
    async handle(req, res) {
      res.set('Cache-Control', 'no-store');
      if (!validateHost(req, res) || !validateOrigin(req, res)) return;
      await nodeHandler(req, res);
    },
    close: () => handler.close()
  };
}
