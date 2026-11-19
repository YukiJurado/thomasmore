if (process.env.NODE_ENV !== 'test') {
  try {
    process.loadEnvFile();
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

function positiveInteger(name, fallback) {
  const value = Number(process.env[name] || fallback);
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${name} must be a positive integer`);
  }
  return value;
}

function commaSeparated(name, fallback) {
  return (process.env[name] || fallback.join(',')).split(',').map((value) => value.trim()).filter(Boolean);
}

export const env = {
  nodeEnv: process.env.NODE_ENV,
  logLevel: process.env.LOG_LEVEL || 'info',
  dbStorage: process.env.DB_STORAGE || './data/events.sqlite',
  databaseUrl: process.env.DATABASE_URL,
  requireDurableStorage: process.env.REQUIRE_DURABLE_STORAGE === 'true',
  mcpAllowedHosts: commaSeparated('MCP_ALLOWED_HOSTS', ['localhost', '127.0.0.1', '::1', 'thomasmore-api.onrender.com']),
  mcpAllowedOrigins: commaSeparated('MCP_ALLOWED_ORIGINS', ['localhost', '127.0.0.1', '::1', 'thomasmore-api.onrender.com']),
  port: positiveInteger('PORT', 3000),
  smtpUrl: process.env.SMTP_URL,
  mailProvider: process.env.MAIL_PROVIDER,
  smtpTimeoutMs: positiveInteger('SMTP_TIMEOUT_MS', 5000),
  resendApiKey: process.env.RESEND_API_KEY,
  mailFrom: process.env.MAIL_FROM,
  mailRetryMs: positiveInteger('MAIL_RETRY_MS', 10000),
  cacheTtlMs: positiveInteger('CACHE_TTL_MS', 30000)
};
