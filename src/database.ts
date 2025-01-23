import Database, { Database as DbType } from 'better-sqlite3';
import { debug } from './debug';

const DEFAULT_LOCK_EXPIRY = 30; // seconds

export function initDb(): DbType {
  const db = new Database('./data.db');
  db.pragma('journal_mode = WAL');
  ensureSyncStateTable(db);
  return db;
}

export function getLastCursor(db: DbType, model: string): string | null {
  const lastCursorRow = db.prepare('SELECT cursor FROM sync_state WHERE collectionType = ?').get(model) as {
    cursor: string | null
  } | undefined;
  return lastCursorRow?.cursor || null;
}

export function updateCursor(db: DbType, cursor: string | null, model: string) {
  const updateSyncState = db.prepare(`
      UPDATE sync_state
      SET cursor = ?
      WHERE collectionType = ?
  `);

  const insertSyncState = db.prepare(`
      INSERT OR IGNORE INTO sync_state (collectionType, cursor)
      VALUES (?, ?)
  `);

  // Try to update first
  const updateResult = updateSyncState.run(cursor, model);

  // If no rows were updated, insert
  if (updateResult.changes === 0) {
    insertSyncState.run(model, cursor);
  }
}

interface SyncStateRow {
  locked_by: string | null;
  locked_at: number | null;
  lock_expiry_seconds: number | null;
}

export function acquireLock(
  db: DbType,
  collectionType: string,
  lockId: string,
  lockExpirySeconds = DEFAULT_LOCK_EXPIRY
): boolean {
  // ensure sync_state row for this collection
  db.prepare(`
    INSERT OR IGNORE INTO sync_state
      (collectionType, cursor, locked_by, locked_at, lock_expiry_seconds)
    VALUES
      (?, null, null, null, ?)
  `).run(collectionType, lockExpirySeconds);

  // read the current lock info
  const row = db
    .prepare(
      `SELECT locked_by, locked_at, lock_expiry_seconds
       FROM sync_state
       WHERE collectionType = ?`
    )
    .get(collectionType) as SyncStateRow;

  const now = Math.floor(Date.now() / 1000);
  const currentLockedBy = row.locked_by;
  const currentLockedAt = row.locked_at;
  const currentExpiry = row.lock_expiry_seconds || DEFAULT_LOCK_EXPIRY;

  let canAcquire = false;

  if (!currentLockedBy) {
    canAcquire = true;
  } else {
    // check if lock is stale
    const elapsed = now - (currentLockedAt || 0);
    if (elapsed > currentExpiry) {
      // previous lock expired
      canAcquire = true;
    }
  }

  if (canAcquire) {
    db.prepare(`
      UPDATE sync_state
      SET locked_by = ?, locked_at = ?, lock_expiry_seconds = ?
      WHERE collectionType = ?
    `).run(lockId, now, lockExpirySeconds, collectionType);

    return true;
  } else {
    return false;
  }
}

export function releaseLock(db: DbType, collectionType: string, lockId: string) {
  const row = db
    .prepare(`SELECT locked_by FROM sync_state WHERE collectionType = ?`)
    .get(collectionType) as { locked_by: string | null };

  if (row.locked_by === lockId) {
    db.prepare(`
      UPDATE sync_state
      SET locked_by = null, locked_at = null
      WHERE collectionType = ?
    `).run(collectionType);

  } 
}

export function ensureSyncStateTable(db: DbType) {
  try {
    const sql = `
      CREATE TABLE IF NOT EXISTS sync_state (
        collectionType TEXT PRIMARY KEY,
        cursor TEXT,
        locked_by TEXT,
        locked_at INTEGER,
        lock_expiry_seconds INTEGER
      )
    `;
    db.prepare(sql).run();
  } catch (error) {
    debug('Error creating sync_state table:', error instanceof Error ? error.message : String(error));
  }
}
