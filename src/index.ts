import { createAgencyFetcher } from './graphql'; // The new factory function from the previous refactor
import { initDb, upsertSalesListings, upsertProperties, upsertRegistrations } from './database';
import { PaginatedResponse, PaginatedItem } from './types';
import { debug } from './debug';
import { Database as DbType } from 'better-sqlite3';
import { getLastCursor, updateCursor } from './database';
import { sleep } from './utils';

interface SyncOperation<T extends PaginatedItem> {
  fetchFunction: (after: string | null, limit: number) => Promise<PaginatedResponse<T>>;
  upsertFunction: (db: DbType, items: T[], deletedIds?: string[]) => Promise<void>;
  cursorKey: string;
}

export async function synchronizeData(
  fetchFunction: (after: string | null, limit: number) => Promise<PaginatedResponse<PaginatedItem>>,
  upsertFunction: (db: DbType, items: PaginatedItem[], deletedIds?: string[]) => Promise<void>,
  db: DbType,
  cursorKey: string
) {
  let after = getLastCursor(db, cursorKey);
  let hasMore = true;
  const limit: number = 500;
  const WAIT_TIME_BETWEEN_REQUESTS = 300;

  while (hasMore) {
    debug(`Fetching data for ${cursorKey} with after=${after} and limit=${limit}`);
    const data = await fetchFunction(after, limit);

    if (data.items) {
      await upsertFunction(db, data.items, data.deletedIds);
    }

    hasMore = data.hasMore;
    after = data.cursor;

    await sleep(WAIT_TIME_BETWEEN_REQUESTS);
  }

  debug(`Data synchronization for ${cursorKey} completed`);
  updateCursor(db, after, cursorKey);
}

async function main() {
  const db = initDb();
  const agencyName = process.env.AGENCY_NAME;

  if (!agencyName) {
    throw new Error('AGENCY_NAME is not set in the environment');
  }

  const { fetchSalesListings, fetchProperties, fetchRegistrations } = createAgencyFetcher(agencyName);
  const syncOperations: Array<SyncOperation<any>> = [
    {
      fetchFunction: fetchSalesListings,
      upsertFunction: upsertSalesListings,
      cursorKey: 'salesListings',
    },
    {
      fetchFunction: fetchProperties,
      upsertFunction: upsertProperties,
      cursorKey: 'properties',
    },
    {
      fetchFunction: fetchRegistrations,
      upsertFunction: upsertRegistrations,
      cursorKey: 'registrations',
    },
  ];

  const POLLING_WAIT_TIME = 10000;

  try {
    while (true) {
      for (const operation of syncOperations) {
        await synchronizeData(
          operation.fetchFunction,
          operation.upsertFunction,
          db,
          operation.cursorKey
        );
      }

      await sleep(POLLING_WAIT_TIME);
    }
  } catch (error) {
    debug('Error syncing data:', error);
  } finally {
    db.close();
    debug('Database connection closed.');
  }
}

main();
