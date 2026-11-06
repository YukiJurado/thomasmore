if (process.env.NODE_ENV !== 'test') {
  try {
    process.loadEnvFile();
  } catch {
    // Allow running without a .env file.
  }
}

export const env = {
  nodeEnv: process.env.NODE_ENV,
  logLevel: process.env.LOG_LEVEL || 'info',
  dbStorage: process.env.DB_STORAGE || './data/events.sqlite',
  port: process.env.PORT || 3000,
  smtpUrl: process.env.SMTP_URL,
  resendApiKey: process.env.RESEND_API_KEY,
  mailFrom: process.env.MAIL_FROM,
  mailRetryMs: Number(process.env.MAIL_RETRY_MS || 10000),
  cacheTtlMs: Number(process.env.CACHE_TTL_MS || 30000)
};
