import { Pool } from 'pg';
import { Field } from './types';
import { debug } from './debug';

const DEFAULT_LOCK_EXPIRY = 60 * 5; // seconds

export async function initDb(): Promise<Pool> {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });
  await ensureSyncStateTable(pool);
  return pool;
}

export async function getLastCursor(pool: Pool, model: string): Promise<string | null> {
  const res = await pool.query(
    'SELECT cursor FROM sync_state WHERE collection_type = $1',
    [model]
  );
  return res.rowCount! > 0 ? res.rows[0].cursor : null;
}

export async function updateCursor(
  pool: Pool,
  cursor: string | null,
  model: string
): Promise<void> {
  await pool.query(
    `
    INSERT INTO sync_state (collection_type, cursor)
    VALUES ($1, $2)
    ON CONFLICT (collection_type)
    DO UPDATE SET cursor = EXCLUDED.cursor
    `,
    [model, cursor]
  );
}

interface SyncStateRow {
  locked_by: string | null;
  locked_at: number | null;
  lock_expiry_seconds: number | null;
}

export async function acquireLock(
  pool: Pool,
  collectionType: string,
  lockId: string,
  lockExpirySeconds = DEFAULT_LOCK_EXPIRY
): Promise<boolean> {
  await pool.query(
    `
    INSERT INTO sync_state (collection_type, cursor, locked_by, locked_at, lock_expiry_seconds)
    VALUES ($1, null, null, null, $2)
    ON CONFLICT (collection_type) DO NOTHING
    `,
    [collectionType, lockExpirySeconds]
  );

  const res = await pool.query(
    `
    SELECT locked_by, locked_at, lock_expiry_seconds
    FROM sync_state
    WHERE collection_type = $1
    `,
    [collectionType]
  );

  const row: SyncStateRow = res.rows[0];
  const now = Math.floor(Date.now() / 1000);
  const currentLockedBy = row.locked_by;
  const currentLockedAt = row.locked_at;
  const currentExpiry = row.lock_expiry_seconds || DEFAULT_LOCK_EXPIRY;
  let canAcquire = false;

  if (!currentLockedBy) {
    canAcquire = true;
  } else {
    const elapsed = now - (currentLockedAt || 0);
    if (elapsed > currentExpiry) {
      canAcquire = true;
    }
  }

  if (canAcquire) {
    await pool.query(
      `
      UPDATE sync_state
      SET locked_by = $1, locked_at = $2, lock_expiry_seconds = $3
      WHERE collection_type = $4
      `,
      [lockId, now, lockExpirySeconds, collectionType]
    );
    return true;
  } else {
    return false;
  }
}

export async function releaseLock(
  pool: Pool,
  collectionType: string,
  lockId: string
): Promise<void> {
  const res = await pool.query(
    'SELECT locked_by FROM sync_state WHERE collection_type = $1',
    [collectionType]
  );
  const row = res.rows[0];
  if (row && row.locked_by === lockId) {
    await pool.query(
      `
      UPDATE sync_state
      SET locked_by = null, locked_at = null
      WHERE collection_type = $1
      `,
      [collectionType]
    );
  }
}

export async function ensureSyncStateTable(pool: Pool): Promise<void> {
  try {
    const sql = `
      CREATE TABLE IF NOT EXISTS sync_state (
        collection_type TEXT PRIMARY KEY,
        cursor TEXT,
        locked_by TEXT,
        locked_at INTEGER,
        lock_expiry_seconds INTEGER
      )
    `;
    await pool.query(sql);
  } catch (error) {
    debug(
      'Error creating sync_state table:',
      error instanceof Error ? error.message : String(error)
    );
  }
}

function cleanValue(val: any): any {
  if (typeof val === 'string') {
    return val.replace(/\0/g, ''); // remove null characters
  }
  return val;
}

export async function upsertItems(
  pool: Pool,
  tableName: string,
  fields: Field[],
  items: any[]
): Promise<void> {
  if (items.length === 0) return;

  if (items.length > 1000) {
    let ids = [];
    for(const item of items) {
      ids.push(item.id + " - " + item.name);
    }
    debug(`COUNT: ${items.length} - IDS: ${ids.join(', ')}`);
  }

  const columnNames = fields.map((f) => f.fieldName);
  const columnsList = columnNames.map((name) => `"${name}"`).join(', ');
  const updateClause = columnNames
    .filter((name) => name !== 'id')
    .map((name) => `"${name}" = EXCLUDED."${name}"`)
    .join(', ');

  const queryText = `
    INSERT INTO "${tableName}" (${columnsList})
    VALUES (${columnNames.map((_, i) => '$' + (i + 1)).join(', ')})
    ON CONFLICT (id) DO UPDATE
    SET ${updateClause}
  `;

  for (const item of items) {
    const values = fields.map((f) => {
      const rawVal = item[f.fieldName] ?? null;
      let val = rawVal;
      if (typeof val === 'boolean') {
        val = val ? 1 : 0;
      } else {
        val = cleanValue(val);
      }
      return val;
    });
    try {
      await pool.query(queryText, values);
    } catch (err) {
      console.error('Error executing SQL:', queryText);
      console.error('With values:', values);
      throw err;
    }
  }
}

export async function ensureTable(
  pool: Pool,
  tableName: string,
  fields: Field[]
): Promise<void> {
  const columns = fields.map((field) => {
    const columnType = getPostgresTypeForField(field);
    if (field.fieldName === 'id') {
      return `"${field.fieldName}" ${columnType} PRIMARY KEY`;
    }
    return `"${field.fieldName}" ${columnType}`;
  });

  const sql = `
    CREATE TABLE IF NOT EXISTS "${tableName}" (
      ${columns.join(', ')}
    )
  `;
  await pool.query(sql);
}

function getPostgresTypeForField(field: Field): string {
  if (!field.isScalar) {
    return 'TEXT';
  }

  if (field.fieldName === 'ts') {
    return 'BIGINT';
  }

  switch (field.fieldType) {
    case 'String':
      return 'TEXT';
    case 'ISO8601DateTime':
      return 'TIMESTAMP WITH TIME ZONE';
    case 'ID':
      return 'TEXT';
    case 'Boolean':
      return 'BOOLEAN';
    case 'Int':
      return 'INTEGER';
    case 'Float':
      return 'REAL';
    default:
      return 'TEXT';
  }
}
