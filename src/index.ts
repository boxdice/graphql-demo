import { Pool } from 'pg';
import { initDb, getLastCursor, updateCursor, upsertItems, ensureTable } from './database';
import { acquireLock, releaseLock } from './database';
import { debug } from './debug';
import { sleep, toPlural } from './utils';
import fetchAndParseSchema from './schema';
import { executeGraphQLRequest, fetchAgencyUrl } from './graphql';
import { Field, Collection, ItemsData } from './types';

const lockedCollections: string[] = [];
let db: Pool | null = null;
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

  db = await initDb();

  while (true) {
    try {
      let collections = await fetchAndParseSchema(process.env.SCHEMA_URL);
      collections = filterCollections(collections, process.env.COLLECTION_TYPES);
      const agencyUrl = await fetchAgencyUrl(process.env.AGENCY_NAME);

      for (const collection of collections) {
        const { collectionType } = collection;
        const lockAcquired = await acquireLock(db, collectionType, processLockId);

        if (!lockAcquired) {
          debug(`Lock for collection "${collectionType}" not acquired. Skipping.`);
          continue;
        }

        lockedCollections.push(collectionType);

        try {
          await processCollection(agencyUrl, db, collection);
        } finally {
          await releaseLock(db, collectionType, processLockId);
          const index = lockedCollections.indexOf(collectionType);
          if (index !== -1) {
            lockedCollections.splice(index, 1);
          }
        }
      }

      debug('All discovered collections have been processed or skipped.');
    } catch (error) {
      debug('Error in main:', error);
    }

    debug('Sleeping for 10 minutes...');
    await sleep(10 * 60 * 1000); // 10 minutes
  }
}

async function processCollection(agencyUrl: string, db: Pool, collection: Collection): Promise<void> {
  const { itemsBaseType, fields } = collection;

  await ensureTable(db, itemsBaseType, fields);
  const query = buildGraphQLQuery(itemsBaseType, fields);
  await fetchAndPersistPaginatedData(agencyUrl, db, collection.collectionType, itemsBaseType, query, fields);
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
  db: Pool,
  collectionType: string,
  itemsBaseType: string,
  query: string,
  fields: Field[]
): Promise<void> {
  let after: string | null = await getLastCursor(db, collectionType);
  let hasMore: boolean = true;
  const limit: number = 1000;

  while (hasMore) {
    const startTime = Date.now();

    let data;
    try {
      data = await executeGraphQLRequest({
        endpoint: agencyUrl,
        query,
        variables: { after, limit },
      });
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      debug(`[xRequestId=${data.xRequestId}] - ${duration}s - Fetched ${itemsBaseType} after=${after} count=${data[toPlural(itemsBaseType)].items.length}`);
    } catch (error) {
      debug(`Error Fetching ${itemsBaseType} page after=${after} limit=${limit}`);
      throw error;
    }

    if (!data) {
      throw new Error(`No data returned for "${itemsBaseType}" query`);
    }

    const itemsData: ItemsData = data[toPlural(itemsBaseType)];
    hasMore = itemsData.hasMore;
    after = itemsData.cursor;

    await upsertItems(db, itemsBaseType, fields, itemsData.items || []);
    await updateCursor(db, after, collectionType);

    // TODO: handle "deletedIds"

    await sleep(PAUSE_BETWEEN_REQUESTS);
  }

  debug(`Finished fetching all data for "${itemsBaseType}".`);
}

/**
 * Filter collections by comma separated list of collection types, e.g. "ContactActivityType,Property"
 */
function filterCollections(collections: Collection[], collectionTypes?: string): Collection[] {
  if (!collectionTypes || collectionTypes.length === 0) {
    return collections;
  }
  
  debug(`Filtering collections by COLLECTION_TYPES: ${collectionTypes}`);
  const allowedCollections = collectionTypes.split(',').map(s => s.trim() + 'Collection');
  return collections.filter(collection => {
    if (allowedCollections.includes(collection.collectionType)) {
      debug(`Syncing ${collection.collectionType} permitted by COLLECTION_TYPES`);
      return true;
    }
    return false;
  });
}

main();
