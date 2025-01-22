import { Database as DbType } from 'better-sqlite3';
import { initDb, getLastCursor, updateCursor } from './database';
import { debug } from './debug';
import { sleep } from './utils';
import parseSchema from './schema';
import { executeGraphQLRequest, fetchAgencyUrl } from './graphql';
const pluralize = require('pluralize');

interface Field {
  fieldName: string;
  isScalar?: boolean;
  fieldType?: string;
}

interface Collection {
  collectionType: string;
  itemsBaseType: string;
  fields: Field[];
}

/**
 * Main entry point
 */
export async function main() {
  if (!process.env.SCHEMA_URL) {
    throw new Error('Missing SCHEMA_URL');
  }
  if (!process.env.AGENCY_NAME) {
    throw new Error('Missing AGENCY_NAME');
  }

  const db = initDb();

  try {
    const collections = await parseSchema(process.env.SCHEMA_URL);
    const agencyUrl = await fetchAgencyUrl(process.env.AGENCY_NAME);

    for (const coll of collections) {
      await processCollection(agencyUrl, db, coll);
    }

    debug('All discovered collections have been fetched and saved.');
  } catch (error) {
    debug('Error in main:', error);
  } finally {
    db.close();
    debug('Database connection closed.');
  }
}

async function processCollection(agencyUrl: string, db: DbType, collection: Collection) {
  const { collectionType, itemsBaseType, fields } = collection;
  ensureTable(db, itemsBaseType, fields);

  const query = buildGraphQLQuery(itemsBaseType, fields);
  await fetchAndPersistPaginatedData(agencyUrl, db, collectionType, itemsBaseType, query, fields);
}

function ensureTable(db: DbType, tableName: string, fields: Field[]) {
  const columns = fields.map((field) =>
    field.fieldName === 'id'
      ? `${field.fieldName} TEXT PRIMARY KEY`
      : `${field.fieldName} TEXT`
  );

  const sql = `
    CREATE TABLE IF NOT EXISTS "${tableName}" (
      ${columns.join(', ')}
    )
  `;
  db.prepare(sql).run();

  debug(`Ensured table "${tableName}".`);
}

function buildGraphQLQuery(baseType: string, fields: Field[]): string {
  const pluralName = toPlural(baseType);
  const scalarFields = fields
    .filter((f) => f.isScalar || f.fieldType === 'ID')
    .map((f) => f.fieldName);

  return `
    query ${pluralName}($after: String, $limit: Int) {
      ${pluralName}(after: $after, limit: $limit) {
        cursor
        deletedIds
        hasMore
        ids
        items {
          ${scalarFields.join('\n')}
        }
      }
    }
  `;
}

async function fetchAndPersistPaginatedData(
  agencyUrl: string,
  db: DbType,
  collectionType: string,
  itemsBaseType: string,
  query: string,
  fields: Field[]
) {
  let after: string | null = getLastCursor(db, collectionType) || null;
  let hasMore = true;
  const limit = 500;
  const pauseBetweenRequests = 100;

  while (hasMore) {
    debug(`Fetching ${itemsBaseType} page after=${after} limit=${limit}`);

    const data = await executeGraphQLRequest({
      endpoint: agencyUrl,
      query,
      variables: { after, limit },
    });

    if (!data) {
      throw new Error(`No data returned for "${itemsBaseType}" query`);
    }

    const itemsData = data[toPlural(itemsBaseType)];
    hasMore = itemsData.hasMore;
    after = itemsData.cursor;

    upsertItems(db, itemsBaseType, fields, itemsData.items || []);
    updateCursor(db, after, collectionType);

    // TODO: handle "deletedIds"

    await sleep(pauseBetweenRequests);
  }

  debug(`Finished fetching all data for "${itemsBaseType}".`);
}

function upsertItems(db: DbType, tableName: string, fields: Field[], items: any[]) {
  if (items.length === 0) return;

  const columnNames = fields.map((f) => f.fieldName);
  const placeholders = fields.map(() => '?').join(', ');
  const sql = `
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

function toPlural(name: string): string {
  const lowerCased = name.charAt(0).toLowerCase() + name.slice(1);
  return pluralize(lowerCased);
}

main();
