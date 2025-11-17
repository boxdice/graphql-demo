"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initDb = initDb;
exports.getLastCursor = getLastCursor;
exports.updateCursor = updateCursor;
exports.acquireLock = acquireLock;
exports.releaseLock = releaseLock;
exports.ensureSyncStateTable = ensureSyncStateTable;
exports.upsertItems = upsertItems;
exports.deleteItems = deleteItems;
exports.ensureTable = ensureTable;
const pg_1 = require("pg");
const debug_1 = require("./debug");
const DEFAULT_LOCK_EXPIRY = 60 * 5; // seconds
async function initDb() {
    const pool = new pg_1.Pool({
        connectionString: process.env.DATABASE_URL,
    });
    await ensureSyncStateTable(pool);
    return pool;
}
async function getLastCursor(pool, model) {
    const res = await pool.query('SELECT cursor FROM sync_state WHERE collection_type = $1', [model]);
    return res.rowCount > 0 ? res.rows[0].cursor : null;
}
async function updateCursor(pool, cursor, model) {
    await pool.query(`
    INSERT INTO sync_state (collection_type, cursor)
    VALUES ($1, $2)
    ON CONFLICT (collection_type)
    DO UPDATE SET cursor = EXCLUDED.cursor
    `, [model, cursor]);
}
async function acquireLock(pool, collectionType, lockId, lockExpirySeconds = DEFAULT_LOCK_EXPIRY) {
    await pool.query(`
    INSERT INTO sync_state (collection_type, cursor, locked_by, locked_at, lock_expiry_seconds)
    VALUES ($1, null, null, null, $2)
    ON CONFLICT (collection_type) DO NOTHING
    `, [collectionType, lockExpirySeconds]);
    const res = await pool.query(`
    SELECT locked_by, locked_at, lock_expiry_seconds
    FROM sync_state
    WHERE collection_type = $1
    `, [collectionType]);
    const row = res.rows[0];
    const now = Math.floor(Date.now() / 1000);
    const currentLockedBy = row.locked_by;
    const currentLockedAt = row.locked_at;
    const currentExpiry = row.lock_expiry_seconds || DEFAULT_LOCK_EXPIRY;
    let canAcquire = false;
    if (!currentLockedBy) {
        canAcquire = true;
    }
    else {
        const elapsed = now - (currentLockedAt || 0);
        if (elapsed > currentExpiry) {
            canAcquire = true;
        }
    }
    if (canAcquire) {
        await pool.query(`
      UPDATE sync_state
      SET locked_by = $1, locked_at = $2, lock_expiry_seconds = $3
      WHERE collection_type = $4
      `, [lockId, now, lockExpirySeconds, collectionType]);
        return true;
    }
    else {
        return false;
    }
}
async function releaseLock(pool, collectionType, lockId) {
    const res = await pool.query('SELECT locked_by FROM sync_state WHERE collection_type = $1', [collectionType]);
    const row = res.rows[0];
    if (row && row.locked_by === lockId) {
        await pool.query(`
      UPDATE sync_state
      SET locked_by = null, locked_at = null
      WHERE collection_type = $1
      `, [collectionType]);
    }
}
async function ensureSyncStateTable(pool) {
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
    }
    catch (error) {
        (0, debug_1.debug)('Error creating sync_state table:', error instanceof Error ? error.message : String(error));
    }
}
function cleanValue(val) {
    if (typeof val === 'string') {
        return val.replace(/\0/g, ''); // remove null characters
    }
    return val;
}
async function upsertItems(pool, tableName, fields, items) {
    if (items.length === 0)
        return;
    if (items.length > 1000) {
        let ids = [];
        for (const item of items) {
            ids.push(item.id + " - " + item.name);
        }
        (0, debug_1.debug)(`COUNT: ${items.length} - IDS: ${ids.join(', ')}`);
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
            }
            else {
                val = cleanValue(val);
            }
            return val;
        });
        try {
            await pool.query(queryText, values);
        }
        catch (err) {
            console.error('Error executing SQL:', queryText);
            console.error('With values:', values);
            throw err;
        }
    }
}
async function deleteItems(db, itemsBaseType, deletedIds) {
    if (deletedIds.length === 0)
        return;
    const query = `
    DELETE FROM "${itemsBaseType}"
    WHERE id = ANY($1)
  `;
    try {
        const result = await db.query(query, [deletedIds]);
        (0, debug_1.debug)(`Deleted ${result.rowCount} records from ${itemsBaseType}`);
    }
    catch (error) {
        (0, debug_1.debug)(`Error deleting records from ${itemsBaseType}:`, error);
        throw error;
    }
}
async function ensureTable(pool, tableName, fields) {
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
function getPostgresTypeForField(field) {
    if (!field.isScalar) {
        return 'TEXT';
    }
    if (field.fieldName === 'ts') {
        return 'BIGINT';
    }
    if (field.fieldName === 'id') {
        return 'INTEGER';
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
