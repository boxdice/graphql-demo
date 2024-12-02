import { fetchSalesListings, fetchProperties, fetchAndSyncData, fetchRegistrations } from './graphql';
import { initDb, upsertSalesListings, upsertProperties, upsertRegistrations } from './database';
import { debug } from './debug';
import { getAccessToken, getApiToken } from './auth';

interface SyncOperation {
  fetchFunction: typeof fetchSalesListings | typeof fetchProperties | typeof fetchRegistrations;
  upsertFunction: typeof upsertSalesListings | typeof upsertProperties | typeof upsertRegistrations;
  name: string;
}

const syncOperations: SyncOperation[] = [
  {
    fetchFunction: fetchSalesListings,
    upsertFunction: upsertSalesListings,
    name: 'salesListings',
  },
  {
    fetchFunction: fetchProperties,
    upsertFunction: upsertProperties,
    name: 'properties',
  },
  {
    fetchFunction: fetchRegistrations,
    upsertFunction: upsertRegistrations,
    name: 'registrations',
  },
];

async function main() {
  const db = initDb();

  const accessToken = await getAccessToken();
  const apiToken = await getApiToken(accessToken);

  try {
    while (true) {
      for (const operation of syncOperations) {
        await fetchAndSyncData(
          operation.fetchFunction,
          operation.upsertFunction,
          accessToken,
          apiToken,
          db,
          operation.name
        );
        debug(`Synced ${operation.name} successfully.`);
      }

      await new Promise(resolve => setTimeout(resolve, 10000));

    }

  } catch (error) {
    debug('Error syncing data:', error);
  } finally {
    db.close();
    debug('Database connection closed.');
  }
}

main();
