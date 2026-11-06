import assert from 'node:assert/strict';
import { it } from 'node:test';
import { databaseOptions } from '../../src/config/database.mjs';

it('keeps isolated SQLite available for local tests without a hosted database', () => {
  assert.deepEqual(databaseOptions({ dbStorage: ':memory:' }), {
    dialect: 'sqlite', storage: ':memory:', logging: false
  });
});

it('requires a hosted connection when durable storage is enabled instead of silently losing data', () => {
  assert.throws(() => databaseOptions({
    dbStorage: './data/events.sqlite', requireDurableStorage: true
  }), /DATABASE_URL is required/);
});

it('configures PostgreSQL with verified TLS even if its URL contains insecure TLS parameters', () => {
  const options = databaseOptions({
    databaseUrl: 'postgresql://student:p%40ss@database.example.com:5433/campus?sslmode=disable'
  });
  assert.equal(options.dialect, 'postgres');
  assert.equal(options.host, 'database.example.com');
  assert.equal(options.port, 5433);
  assert.equal(options.database, 'campus');
  assert.equal(options.username, 'student');
  assert.equal(options.password, 'p@ss');
  assert.deepEqual(options.dialectOptions.ssl, { rejectUnauthorized: true });
});

it('rejects unrelated URLs and incomplete database credentials', () => {
  assert.throws(() => databaseOptions({ databaseUrl: 'https://example.com/db' }), /postgres/);
  assert.throws(() => databaseOptions({ databaseUrl: 'postgres://user@localhost/db' }), /password/);
});
