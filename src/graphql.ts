import axios from 'axios';
import { debug } from './debug';
import { SalesListing, Property, GraphQLResponse, PaginatedResponse, Registration } from './types';
import { getAccessToken } from './auth'

const DATE_LISTED_GTE = '2024-01-01';

async function executeGraphQLQuery<GraphQLResponse>(
  agencyToken: string,
  query: string,
  variables: Record<string, unknown>
): Promise<GraphQLResponse> {
  const graphqlEndpoint = `${process.env.GRAPHQL_ENDPOINT}`;
  const accessToken = await getAccessToken();
  const payload = {
    token: agencyToken,
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


    if (response.status != 200) {
      debug('unexpected response code: ', response.status);

      // todo: handle access token expired, rate limit responses and general errors

    }

    if (!response.data.data) {
      debug('unexpected response data: ', response.data);
    }

    return response.data.data;
  } catch (error: unknown) {
    if (error instanceof Error) {
      debug('Error fetching data:', error.message);
    } else if (axios.isAxiosError(error) && error.response) {
      debug('Axios Error fetching data:', error.response.data);
    } else {
      debug('General Error fetching data:', String(error));
    }
    throw error;
  }
}

export async function fetchSalesListings(
  agencyToken: string,
  after: string | null = null,
  limit: number = 100
): Promise<PaginatedResponse<SalesListing>> {
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

  const variables = { after, limit, dateListedGte: DATE_LISTED_GTE };

  const data: GraphQLResponse = await executeGraphQLQuery(
    agencyToken,
    query,
    variables
  );

  return data.salesListings
}

export async function fetchProperties(
  agencyToken: string,
  after: string | null = null,
  limit: number = 100
): Promise<PaginatedResponse<Property>> {
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

  const variables = { after, limit, dateListedGte: DATE_LISTED_GTE };

  const data: GraphQLResponse = await executeGraphQLQuery(
    agencyToken,
    query,
    variables
  );

  if (!data.salesListings?.properties) {
    throw new Error('Properties data not found in response');
  }

  return data.salesListings.properties;
}


export async function fetchRegistrations(
  agencyToken: string,
  after: string | null = null,
  limit: number = 100
): Promise<PaginatedResponse<Registration>> {
  const query = `
    query($after: String, $limit: Int, $dateListedGte: ISO8601Date) {
      salesListings(dateListedGte: $dateListedGte) {
        registrations(after: $after, limit: $limit) {
          cursor
          hasMore
          deletedIds
          items {
            id
            interestLevel
            contactId
            salesListingId
            contact {
              id
              fullName
              email
              mobile
            }
          }
        }
      }
    }
  `;

  const variables = { after, limit, dateListedGte: DATE_LISTED_GTE };


  const data: GraphQLResponse = await executeGraphQLQuery(
    agencyToken,
    query,
    variables
  );

  if (!data.salesListings?.registrations) {
    throw new Error('Registrations data not found in response');
  }

  return data.salesListings.registrations;
}
