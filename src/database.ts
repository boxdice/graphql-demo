import Database, { Database as DbType } from 'better-sqlite3';
import { debug } from './debug';

export function initDb(): DbType {
  const db = new Database('./data.db');


  db.exec(`
      CREATE TABLE IF NOT EXISTS sync_state
      (
          id          INTEGER PRIMARY KEY AUTOINCREMENT,
          last_cursor TEXT,
          model       TEXT
      )`);


  return db;
}

export function getLastCursor(db: DbType, model: string): string | null {
  const lastCursorRow = db.prepare('SELECT last_cursor FROM sync_state WHERE model = ?').get(model) as {
    last_cursor: string | null
  };
  return lastCursorRow?.last_cursor || null;
}

export function updateCursor(db: DbType, cursor: string | null, model: string) {
  const existingRow = db.prepare('SELECT id FROM sync_state WHERE model = ?').get(model) as { id: number } | undefined;

  const updateSyncState = db.prepare(`
      UPDATE sync_state
      SET last_cursor = ?
      WHERE id = ?
  `);

  const insertSyncState = db.prepare(`
      INSERT INTO sync_state (last_cursor, model)
      VALUES (?, ?)
  `);

  if (existingRow) {
    updateSyncState.run(cursor, existingRow.id);
  } else {
    insertSyncState.run(cursor, model);
  }
}
