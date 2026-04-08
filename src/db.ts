import { mkdirSync } from 'node:fs';
import os from 'node:os';
import path, { dirname } from 'node:path';

import Database from 'better-sqlite3';

const DEFAULT_DB_PATH = path.join(os.homedir(), '.mcp-infra-lens', 'metrics.db');

const databaseCache = new Map<string, Database.Database>();

export function resolveDatabasePath(): string {
  return process.env.INFRA_LENS_DB ?? DEFAULT_DB_PATH;
}

export function getDatabase(): Database.Database {
  const databasePath = resolveDatabasePath();
  const cached = databaseCache.get(databasePath);
  if (cached) {
    return cached;
  }

  if (databasePath !== ':memory:') {
    mkdirSync(dirname(databasePath), { recursive: true });
  }

  const database = new Database(databasePath);
  database.pragma('journal_mode = WAL');
  database.exec(`
    CREATE TABLE IF NOT EXISTS snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      host TEXT NOT NULL,
      label TEXT DEFAULT 'default',
      timestamp INTEGER NOT NULL,
      cpu_percent REAL NOT NULL,
      memory_percent REAL NOT NULL,
      load_1 REAL NOT NULL,
      raw_json TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_snapshots_host_label ON snapshots(host, label);
    CREATE INDEX IF NOT EXISTS idx_snapshots_host_timestamp ON snapshots(host, timestamp);
  `);

  databaseCache.set(databasePath, database);
  return database;
}

export function closeAllDatabases(): void {
  for (const database of databaseCache.values()) {
    database.close();
  }
  databaseCache.clear();
}
