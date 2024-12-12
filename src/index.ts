import { fetchSalesListings, fetchProperties, fetchRegistrations } from './graphql';
import { initDb, upsertSalesListings, upsertProperties, upsertRegistrations } from './database';
import { PaginatedResponse, PaginatedItem } from './types';
import { debug } from './debug';
import { getAccessToken, getAgencyToken } from './auth';
import { Database as DbType } from 'better-sqlite3';
import { getLastCursor, updateCursor } from './database';


interface SyncOperation<T extends PaginatedItem> {
  fetchFunction: (agencyToken: string, after: string | null, limit: number) => Promise<PaginatedResponse<T>>;
  upsertFunction: (db: DbType, items: T[], deletedIds?: string[]) => Promise<void>;
  cursorKey: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
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

export async function synchronizeData(
  fetchFunction: (agencyToken: string, after: string | null, limit: number) => Promise<PaginatedResponse<PaginatedItem>>,
  upsertFunction: (db: DbType, items: PaginatedItem[], deletedIds?: string[]) => Promise<void>,
  agencyToken: string,
  db: DbType,
  cursorKey: string
) {
  let after = getLastCursor(db, cursorKey);
  let hasMore = true;
  const limit: number = 100;
  const WAIT_TIME_BETWEEN_REQUESTS = 300;

  while (hasMore) {
    debug(`Fetching data for ${cursorKey} with after=${after} and limit=${limit}`);

    const data = await fetchFunction(agencyToken, after, limit);

    if (data.items) {
      await upsertFunction(db, data.items, data.deletedIds);
    }

    hasMore = data.hasMore;
    after = data.cursor;

    await new Promise(resolve => setTimeout(resolve, WAIT_TIME_BETWEEN_REQUESTS));
  }

  debug(`Data synchronization for ${cursorKey} completed`);
  updateCursor(db, after, cursorKey);
}

async function main() {
  const db = initDb();
  const accessToken = await getAccessToken();
  const agencyToken = await getAgencyToken(accessToken);
  const POLLING_WAIT_TIME = 10000;

  try {
    while (true) {
      for (const operation of syncOperations) {
        await synchronizeData(
          operation.fetchFunction,
          operation.upsertFunction,
          agencyToken,
          db,
          operation.cursorKey
        );
      }

      await new Promise(resolve => setTimeout(resolve, POLLING_WAIT_TIME));

    }
  } catch (error) {
    debug('Error syncing data:', error);
  } finally {
    db.close();
    debug('Database connection closed.');
  }
}

main();
