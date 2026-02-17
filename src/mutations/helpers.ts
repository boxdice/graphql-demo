import { Pool } from 'pg';
import { fetchAgencyUrl } from '../graphql';
import { initDb } from '../database';
import { debug } from '../debug';

let cachedAgencyUrl: string | null = null;
let cachedDb: Pool | null = null;

export async function getAgencyUrl(): Promise<string> {
  if (!cachedAgencyUrl) {
    if (!process.env.AGENCY_NAME) {
      throw new Error('Missing AGENCY_NAME environment variable');
    }
    cachedAgencyUrl = await fetchAgencyUrl(process.env.AGENCY_NAME, process.env.AGENCY_ID);
    debug(`Agency URL: ${cachedAgencyUrl}`);
  }
  return cachedAgencyUrl;
}

export async function getDb(): Promise<Pool> {
  if (!cachedDb) {
    cachedDb = await initDb();
  }
  return cachedDb;
}

export async function fetchActiveSalesListing(pool: Pool): Promise<{ id: string; status: string; propertyId: string }> {
  const res = await pool.query(`
    SELECT id, status, "propertyId" FROM "SalesListing"
    WHERE status IS NOT NULL AND "propertyId" IS NOT NULL
    ORDER BY
      CASE WHEN LOWER(status) = 'current' THEN 0
           WHEN LOWER(status) = 'active' THEN 1
           ELSE 2
      END,
      id DESC
    LIMIT 1
  `);

  if (res.rowCount === 0) {
    throw new Error('No sales listings found in local DB. Has the sync been run?');
  }

  return res.rows[0];
}

export async function fetchActiveConsultant(pool: Pool): Promise<{ id: string; firstName: string; lastName: string; fullName: string; email: string }> {
  const res = await pool.query(`
    SELECT id, "firstName", "lastName", "fullName", email
    FROM "Consultant"
    WHERE (archived = false OR archived IS NULL)
      AND email IS NOT NULL
      AND id::text != '1'
    ORDER BY id
    LIMIT 1
  `);

  if (res.rowCount === 0) {
    throw new Error('No active consultants found in local DB. Has the sync been run?');
  }

  return res.rows[0];
}

export async function fetchActiveConsultants(pool: Pool, count: number): Promise<{ id: string; firstName: string; lastName: string; fullName: string; email: string }[]> {
  const res = await pool.query(`
    SELECT id, "firstName", "lastName", "fullName", email
    FROM "Consultant"
    WHERE (archived = false OR archived IS NULL)
      AND email IS NOT NULL
      AND id::text != '1'
    ORDER BY id
    LIMIT $1
  `, [count]);

  if (res.rowCount === 0) {
    throw new Error('No active consultants found in local DB. Has the sync been run?');
  }

  return res.rows;
}

export async function fetchUnusedProperties(pool: Pool, count: number): Promise<{ id: string }[]> {
  const res = await pool.query(`
    SELECT p.id FROM "Property" p
    LEFT JOIN "SalesListing" sl ON sl."propertyId"::text = p.id::text
    WHERE sl.id IS NULL
    ORDER BY RANDOM()
    LIMIT $1
  `, [count]);

  if (res.rowCount === 0) {
    throw new Error('No unused properties found in local DB (all properties already have sales listings). Has the sync been run?');
  }

  return res.rows;
}

export async function fetchUnusedProperty(pool: Pool): Promise<{ id: string }> {
  const rows = await fetchUnusedProperties(pool, 1);
  return rows[0];
}

export async function fetchOffice(pool: Pool): Promise<{ id: string }> {
  const res = await pool.query(`
    SELECT id FROM "Office"
    ORDER BY id
    LIMIT 1
  `);

  if (res.rowCount === 0) {
    throw new Error('No offices found in local DB. Has the sync been run?');
  }

  return res.rows[0];
}

export async function fetchContacts(pool: Pool, count: number): Promise<{ id: string }[]> {
  const res = await pool.query(`
    SELECT id FROM "Contact"
    ORDER BY id
    LIMIT $1
  `, [count]);

  if (res.rowCount === 0) {
    throw new Error('No contacts found in local DB. Has the sync been run?');
  }

  return res.rows;
}

export async function fetchSource(pool: Pool): Promise<{ id: string }> {
  const res = await pool.query(`
    SELECT id FROM "Source"
    ORDER BY id
    LIMIT 1
  `);

  if (res.rowCount === 0) {
    throw new Error('No sources found in local DB. Has the sync been run?');
  }

  return res.rows[0];
}

export async function fetchSalesListingType(pool: Pool): Promise<{ id: string }> {
  const res = await pool.query(`
    SELECT id FROM "SalesListingType"
    ORDER BY id
    LIMIT 1
  `);

  if (res.rowCount === 0) {
    throw new Error('No sales listing types found in local DB. Has the sync been run?');
  }

  return res.rows[0];
}

export async function fetchFeaturePropertyType(pool: Pool): Promise<{ id: string }> {
  const res = await pool.query(`
    SELECT id FROM "FeaturePropertyType"
    ORDER BY id
    LIMIT 1
  `);

  if (res.rowCount === 0) {
    throw new Error('No feature property types found in local DB. Has the sync been run?');
  }

  return res.rows[0];
}

export async function fetchRentalAppraisal(pool: Pool): Promise<{ id: string; propertyId: string }> {
  const res = await pool.query(`
    SELECT id, "propertyId" FROM "RentalListing"
    WHERE "propertyId" IS NOT NULL
    ORDER BY id DESC
    LIMIT 1
  `);

  if (res.rowCount === 0) {
    throw new Error('No rental listings found in local DB. Has the sync been run?');
  }

  return res.rows[0];
}

export async function fetchSalesVoucher(pool: Pool): Promise<{ id: string; salesListingId: string }> {
  const res = await pool.query(`
    SELECT id, "salesListingId" FROM "SalesVoucher"
    ORDER BY id DESC
    LIMIT 1
  `);

  if (res.rowCount === 0) {
    throw new Error('No sales vouchers found in local DB. Has the sync been run?');
  }

  return res.rows[0];
}

export async function fetchPropertyTypeByName(pool: Pool, name: string): Promise<{ id: string; name: string }> {
  const res = await pool.query(`
    SELECT id, name FROM "PropertyType"
    WHERE LOWER(name) = LOWER($1)
    LIMIT 1
  `, [name]);

  if (res.rowCount === 0) {
    throw new Error(`No property type found matching name "${name}" in local DB. Has the sync been run?`);
  }

  return res.rows[0];
}

export function assertEqual(label: string, actual: any, expected: any): void {
  const actualStr = JSON.stringify(actual);
  const expectedStr = JSON.stringify(expected);
  if (actualStr !== expectedStr) {
    throw new Error(`ASSERTION FAILED [${label}]: expected ${expectedStr}, got ${actualStr}`);
  }
}

export function assertEqualIgnoreCase(label: string, actual: string, expected: string): void {
  if (actual?.toLowerCase() !== expected?.toLowerCase()) {
    throw new Error(`ASSERTION FAILED [${label}]: expected "${expected}", got "${actual}"`);
  }
}

export function assertDefined(label: string, value: any): void {
  if (value === undefined || value === null) {
    throw new Error(`ASSERTION FAILED [${label}]: value is ${value}`);
  }
}
