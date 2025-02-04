import Database, { Database as DbType, Statement } from 'better-sqlite3';
import { Field } from './types';
import { debug } from './debug';

const DEFAULT_LOCK_EXPIRY = 60 * 5; // seconds

export function initDb(): DbType {
  const db: DbType = new Database('./data.db');
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

export function updateCursor(db: DbType, cursor: string | null, model: string): void {
  const updateSyncState: Statement = db.prepare(`
      UPDATE sync_state
      SET cursor = ?
      WHERE collectionType = ?
  `);

  const insertSyncState: Statement = db.prepare(`
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

  const now: number = Math.floor(Date.now() / 1000);
  const currentLockedBy: string | null = row.locked_by;
  const currentLockedAt: number | null = row.locked_at;
  const currentExpiry: number = row.lock_expiry_seconds || DEFAULT_LOCK_EXPIRY;
  let canAcquire: boolean = false;

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

export function releaseLock(db: DbType, collectionType: string, lockId: string): void {
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

export function ensureSyncStateTable(db: DbType): void {
  try {
    const sql: string = `
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

export function upsertItems(db: DbType, tableName: string, fields: Field[], items: any[]): void {
  
  if (items.length === 0) return;

  const columnNames: string[]  = fields.map((f) => f.fieldName);
  const placeholders: string = fields.map(() => '?').join(', ');
  const sql: string = `
    INSERT OR REPLACE INTO "${tableName}"
    (${columnNames.join(', ')})
    VALUES (${placeholders})
  `;
  const stmt = db.prepare(sql);

  for (const item of items) {
    const values = fields.map((f) => {
      const val = item[f.fieldName] ?? null;
      return typeof val === 'boolean' ? (val ? 1 : 0) : val;
    });
    stmt.run(values);
  }

}

export function ensureTable(db: DbType, tableName: string, fields: Field[]): void {
  const columns = fields.map((field) => {
    const columnType = getSQLiteTypeForField(field);
    if (field.fieldName === 'id') {
      return `${field.fieldName} ${columnType} PRIMARY KEY`;
    }
    return `${field.fieldName} ${columnType}`;
  });

  const sql = `
    CREATE TABLE IF NOT EXISTS "${tableName}" (
      ${columns.join(', ')}
    )
  `;
  db.prepare(sql).run();
}

function getSQLiteTypeForField(field: Field): string {
  if (!field.isScalar) {
    return 'TEXT';
  }

  if (field.fieldName === 'ts') {
    return 'INTEGER';
  }

  switch (field.fieldType) {
    case 'String':
    case 'ISO8601DateTime':
      return 'TEXT';
    case 'ID':
    case 'Boolean':
    case 'Int':
      return 'INTEGER';
    case 'Float':
      return 'REAL';
    default:
      return 'TEXT';
  }
}