import axios from 'axios';
import { debug } from './debug';
import { SalesListing, Property, GraphQLResponse, PaginatedResponse, Registration } from './types';
import { getAccessToken } from './auth';

const DATE_LISTED_GTE = '2024-01-01';

interface Agency {
  id: string;
  name: string;
  apiUrl: string;
}

interface GraphQLRequestOptions {
  endpoint: string;
  query: string;
  variables?: Record<string, unknown>;
}

async function executeGraphQLRequest<T>(options: GraphQLRequestOptions): Promise<T> {
  const { endpoint, query, variables = {} } = options;
  const accessToken = await getAccessToken();
  const payload = { query, variables };

  try {
    const response = await axios.post(endpoint, payload, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (response.status !== 200) {
      debug('Unexpected response code:', response.status);
    }

    if (!response.data.data) {
      debug('Unexpected response data:', response.data);
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

async function fetchAgencyUrl(agencyName: string): Promise<string> {
  const query = `
    query {
      apiReferenceUrl
      apiSchemaUrl
      agencies {
        id
        name
        apiUrl
      }
    }
  `;


  const data = await executeGraphQLRequest<{ agencies: Agency[] }>({
    endpoint: `${process.env.DEVELOPER_GRAPHQL_ENDPOINT}`,
    query,
  });

  const agency = data.agencies.find(a => a.name === agencyName);
  if (!agency) {
    throw new Error(`No agency found matching AGENCY_NAME: "${agencyName}" in response: ${JSON.stringify(data)}`);
  }

  debug('agency apiUrl', agency.apiUrl);
  return agency.apiUrl;
}

export function createAgencyFetcher(agencyName: string) {

  let agencyUrl: Promise<string> | null = null;

  async function getAgencyUrl(): Promise<string> {
    if (!agencyUrl) {
      agencyUrl = fetchAgencyUrl(agencyName);
    }
    return agencyUrl;
  }

  async function fetchSalesListings(
    after: string | null = null,
    limit: number
  ): Promise<PaginatedResponse<SalesListing>> {
    const endpoint = await getAgencyUrl();
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
    const data = await executeGraphQLRequest<GraphQLResponse>({ endpoint, query, variables });
    return data.salesListings;
  }

  async function fetchProperties(
    after: string | null = null,
    limit: number
  ): Promise<PaginatedResponse<Property>> {
    const endpoint = await getAgencyUrl();
    const query = `
      query($after: String, $limit: Int, $dateListedGte: ISO8601Date) {
        salesListings(dateListedGte: $dateListedGte) {
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
    const data = await executeGraphQLRequest<GraphQLResponse>({ endpoint, query, variables });

    if (!data.salesListings?.properties) {
      throw new Error('Properties data not found in response');
    }

    return data.salesListings.properties;
  }

  async function fetchRegistrations(
    after: string | null = null,
    limit: number
  ): Promise<PaginatedResponse<Registration>> {
    const endpoint = await getAgencyUrl();
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
    const data = await executeGraphQLRequest<GraphQLResponse>({ endpoint, query, variables });

    if (!data.salesListings?.registrations) {
      throw new Error('Registrations data not found in response');
    }

    return data.salesListings.registrations;
  }

  return {
    fetchSalesListings,
    fetchProperties,
    fetchRegistrations,
  };
}
