import axios from 'axios';
import { debug } from './debug';
import { SalesListing, Property } from './types';
import { getLastCursor, updateCursor } from './database';

export async function fetchAndSyncData(
  fetchFunction: Function,
  upsertFunction: Function,
  accessToken: string,
  apiToken: string,
  db: any,
  model: string
) {
  let after = getLastCursor(db, model);
  let hasMore = true;
  const limit: number = 100;

  while (hasMore) {
    debug(`Fetching data for model=${model} with after=${after} and limit=${limit}`);

    let data = await fetchFunction(accessToken, apiToken, after, limit);

    if (model != 'salesListings') {
      data = data['salesListings']
    }

    if (data[model] && data[model].items) {
      const items = data[model].items.map((item: any) => ({
        ...item,
      }));

      await upsertFunction(db, items);
    }

    hasMore = data[model].hasMore;
    after = data[model].cursor;

    await new Promise(resolve => setTimeout(resolve, 300));
  }

  debug(`Data synchronization for model=${model} completed`);
  updateCursor(db, after, model);
}

async function fetchGraphQLData<T>(
  accessToken: string,
  apiToken: string,
  query: string,
  variables: Record<string, any>
): Promise<T> {
  const graphqlEndpoint = `${process.env.GRAPHQL_ENDPOINT}`;

  const payload = {
    token: apiToken,
    query,
    variables,
  };

  console.log(query);
  console.log(variables);

  try {
    const response = await axios.post(graphqlEndpoint, payload, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    return response.data.data;
  } catch (error: any) {
    debug('Error fetching data:', error.response?.data || error.message);
    throw error;
  }
}

export async function fetchSalesListings(
  accessToken: string,
  apiToken: string,
  after: string | null = null,
  limit: number = 100
): Promise<{ salesListings: { cursor: string; hasMore: boolean; items: SalesListing[] } }> {
  const query = `
    query($after: String, $limit: Int, $dateListedGte: ISO8601Date) {
      salesListings(after: $after, limit: $limit, dateListedGte: $dateListedGte) {
        cursor
        hasMore
        items {
          id
          propertyId
          status
        }
      }
    }
  `;

  const variables = { after, limit, dateListedGte: "2023-12-01" };

  return fetchGraphQLData(accessToken, apiToken, query, variables);
}

export async function fetchProperties(
  accessToken: string,
  apiToken: string,
  after: string | null = null,
  limit: number = 100
): Promise<{ salesListings: { cursor: string; hasMore: boolean; items: Property[] } }> {
  const query = `
    query($after: String, $limit: Int, $dateListedGte: ISO8601Date) {
      salesListings (dateListedGte: $dateListedGte) {
        properties(after: $after, limit: $limit) {
          cursor
          hasMore
          items {
            id
            address
            beds
          }
        }
      }
    }
  `;

  const variables = { after, limit, dateListedGte: "2023-12-01" };

  return fetchGraphQLData(accessToken, apiToken, query, variables);
}
export async function fetchRegistrations(
  accessToken: string,
  apiToken: string,
  after: string | null = null,
  limit: number = 100
): Promise<{ salesListings: { cursor: string; hasMore: boolean; items: Property[] } }> {
  const query = `
    query($after: String, $limit: Int, $dateListedGte: ISO8601Date) {
      salesListings(dateListedGte: $dateListedGte) {
        registrations(after: $after, limit: $limit) {
          cursor
          hasMore
          items {
            id
            interestLevel
            contactId
          }
        }
      }
    }
  `;

  const variables = { after, limit, dateListedGte: "2023-12-01" };

  return fetchGraphQLData(accessToken, apiToken, query, variables);
}
