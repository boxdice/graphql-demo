import Database, { Database as DbType } from 'better-sqlite3';
import { debug } from './debug';
import { SalesListing, Property, Registration } from './types';

export function initDb(): DbType {
  const db = new Database('./data.db');

  db.exec(`
      CREATE TABLE IF NOT EXISTS sales_listings
      (
          id          INTEGER PRIMARY KEY,
          property_id INTEGER,
          status      TEXT
      )
  `);

  db.exec(`
      CREATE TABLE IF NOT EXISTS properties
      (
          id      INTEGER PRIMARY KEY,
          address TEXT,
          beds    INTEGER
      )
  `);

  db.exec(`
      CREATE TABLE IF NOT EXISTS registrations
      (
          id               INTEGER PRIMARY KEY,
          contact_id       INTEGER,
          sales_listing_id INTEGER,
          interest_level   TEXT,
          full_name        TEXT
      )`);

  db.exec(`
    CREATE TABLE IF NOT EXISTS comments
    (
        id              INTEGER PRIMARY KEY,
        comment         TEXT,
        registration_id INTEGER
    )`);


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

  debug(`Saved cursor position: ${cursor} for model ${model}`);

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

export async function upsertSalesListings(db: DbType, data: SalesListing[]) {
  debug('Data to sync:', data);

  const insert = db.prepare(`
      INSERT INTO sales_listings (id, property_id, status)
      VALUES (?, ?, ?)
      ON CONFLICT
          (id)
          DO UPDATE SET
      property_id = excluded.property_id,
      status = excluded.status
  `);

  const insertMany = db.transaction((items: SalesListing[]) => {
    for (const item of items) {
      insert.run(item.id, item.propertyId || null, item.status || null);
    }
  });

  insertMany(data);
}

export async function upsertProperties(db: DbType, data: Property[]) {
  debug('Data to sync:', data);

  const insert = db.prepare(`
      INSERT INTO properties (id, address, beds)
      VALUES (?, ?, ?)
      ON CONFLICT
          (id)
          DO UPDATE SET
      address = excluded.address,
      beds = excluded.beds
  `);

  const insertMany = db.transaction((items: Property[]) => {
    for (const item of items) {
      insert.run(item.id, item.address || null, item.beds);
    }
  });

  insertMany(data);
}

export async function upsertRegistrations(
  db: DbType,
  data: Registration[],
  deletedIds?: string[]
): Promise<void> {
  debug('Data to sync:', data);

  const insert = db.prepare(`
      INSERT INTO registrations (id, contact_id, interest_level, full_name, sales_listing_id)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT
          (id)
          DO UPDATE SET
      contact_id = excluded.contact_id,
      interest_level = excluded.interest_level,
      full_name = excluded.full_name,
      sales_listing_id = excluded.sales_listing_id
  `);

  const insertMany = db.transaction((items: Registration[]) => {
    for (const item of items) {
      insert.run(item.id, item.contactId, item.interestLevel, item.contact?.fullName, item.salesListingId);
    }
  });

  insertMany(data);

  if ((deletedIds?.length ?? 0) > 0) {
    const deleteStatement = db.prepare(`
      DELETE FROM registrations
      WHERE id IN (${deletedIds!.map(() => '?').join(', ')})
    `);
    deleteStatement.run(...deletedIds!);
  }
}
