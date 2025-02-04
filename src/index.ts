import { Database as DbType } from 'better-sqlite3';
import { initDb, getLastCursor, updateCursor, upsertItems, ensureTable } from './database';
import { acquireLock, releaseLock } from './database';
import { debug } from './debug';
import { sleep } from './utils';
import fetchAndParseSchema from './schema';
import { executeGraphQLRequest, fetchAgencyUrl } from './graphql';
import { Field, Collection, ItemsData } from './types';

const pluralize = require('pluralize');

const lockedCollections: string[] = [];
let db: DbType | null = null;
const processNum = process.env.PROCESS_NUM || '1';
const processLockId = `process-${processNum}`;
const PAUSE_BETWEEN_REQUESTS = parseInt(process.env.PAUSE_BETWEEN_REQUESTS || '1000', 10);

/**
 * Main entry point
 */
export async function main(): Promise<void> {
  if (!process.env.SCHEMA_URL) {
    throw new Error('Missing SCHEMA_URL');
  }
  if (!process.env.AGENCY_NAME) {
    throw new Error('Missing AGENCY_NAME');
  }

  db = initDb();

  process.on('SIGINT', () => handleSignal('SIGINT'));
  process.on('SIGTERM', () => handleSignal('SIGTERM'));

  try {
    const collections = await fetchAndParseSchema(process.env.SCHEMA_URL);
    const agencyUrl = await fetchAgencyUrl(process.env.AGENCY_NAME);

    for (const collection of collections) {
      const { collectionType } = collection;

      const lockAcquired = acquireLock(db, collectionType, processLockId);

      if (!lockAcquired) {
        debug(`Lock for collection "${collectionType}" not acquired. Skipping.`);
        continue;
      }

      lockedCollections.push(collectionType);

      try {
        await processCollection(agencyUrl, db, collection);
      } finally {
        releaseLock(db, collectionType, processLockId);
        lockedCollections.splice(lockedCollections.indexOf(collectionType), 1);
      }
    }

    debug('All discovered collections have been processed or skipped.');
  } catch (error) {
    debug('Error in main:', error);
  } finally {
    db.close();
    debug('Database connection closed.');
  }
}

async function processCollection(agencyUrl: string, db: DbType, collection: Collection): Promise<void> {
  const { collectionType, itemsBaseType, fields } = collection;
  
  ensureTable(db, itemsBaseType, fields);
  const query = buildGraphQLQuery(itemsBaseType, fields);
  await fetchAndPersistPaginatedData(agencyUrl, db, collectionType, itemsBaseType, query, fields);
}


function handleSignal(signal: string): void {
  debug(`Received ${signal}, releasing locks...`);
  for (const collectionType of lockedCollections) {
    releaseLock(db!, collectionType, processLockId);
  }
  if (db) {
    db.close();
  }
  process.exit(0); 
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
): Promise<void> {
  let after: string | null = getLastCursor(db, collectionType);
  let hasMore: boolean = true;
  const limit: number = 500;

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

    const itemsData: ItemsData = data[toPlural(itemsBaseType)];
    hasMore= itemsData.hasMore;
    after = itemsData.cursor;

    upsertItems(db, itemsBaseType, fields, itemsData.items || []);
    updateCursor(db, after, collectionType);

    // TODO: handle "deletedIds"

    await sleep(PAUSE_BETWEEN_REQUESTS);
  }

  debug(`Finished fetching all data for "${itemsBaseType}".`);
}


function toPlural(name: string): string {
  const lowerCased: string = name.charAt(0).toLowerCase() + name.slice(1);
  return pluralize(lowerCased);
}

main();
