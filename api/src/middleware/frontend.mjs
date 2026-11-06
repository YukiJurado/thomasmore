import express from 'express';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

export function attachFrontend(app, directory) {
  if (!directory || !existsSync(join(directory, 'index.html'))) return;
  app.use(express.static(directory));
  // Only known Vue routes receive the SPA; unknown API URLs remain JSON 404s.
  app.get(['/', '/events/new', '/events/:id', '/stats'], (_req, res) => {
    res.sendFile(join(directory, 'index.html'));
  });
}
