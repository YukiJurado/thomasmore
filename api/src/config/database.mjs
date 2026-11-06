// Build connection options without exposing credentials in logs or applying URL TLS overrides.
function postgresUrl(value) {
  const url = new URL(value);
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) {
    throw new Error('DATABASE_URL must use postgres:// or postgresql://');
  }
  const database = decodeURIComponent(url.pathname.slice(1));
  if (!url.hostname || !url.username || !url.password || !database) {
    throw new Error('DATABASE_URL must include a host, username, password and database');
  }
  return url;
}

export function databaseOptions(settings) {
  if (!settings.databaseUrl) {
    if (settings.requireDurableStorage) {
      throw new Error('DATABASE_URL is required when durable storage is enabled');
    }
    return { dialect: 'sqlite', storage: settings.dbStorage, logging: false };
  }
  const url = postgresUrl(settings.databaseUrl);
  return {
    dialect: 'postgres',
    host: url.hostname,
    port: Number(url.port || 5432),
    database: decodeURIComponent(url.pathname.slice(1)),
    username: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    logging: false,
    // Do not pass sslmode query parameters through pg: they can replace this TLS configuration.
    dialectOptions: { ssl: { rejectUnauthorized: true }, connectionTimeoutMillis: 10000 },
    pool: { max: 5, min: 0, idle: 10000, acquire: 30000 }
  };
}
