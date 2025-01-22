import axios from 'axios';
import { debug } from './debug';
import { getAccessToken } from './auth';


export async function executeGraphQLRequest(
  options: {
    endpoint: string;
    query: string;
    variables?: Record<string, any>;
    headers?: Record<string, string>;
  }
) {
  const { endpoint, query, variables = {}, headers = {} } = options;
  const accessToken = await getAccessToken();
  const payload = { query, variables };

  try {
    const response = await axios.post(endpoint, payload, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        ...headers,
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

export async function fetchAgencyUrl(agencyName: string): Promise<string> {
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

  const data = await executeGraphQLRequest({
    endpoint: `${process.env.DEVELOPER_GRAPHQL_ENDPOINT}`,
    query,
  });

  const agency = data.agencies.find((a: { name: string; }) => a.name === agencyName);
  if (!agency) {
    throw new Error(`No agency found matching AGENCY_NAME: "${agencyName}" in response: ${JSON.stringify(data)}`);
  }

  debug('agency apiUrl', agency.apiUrl);
  return agency.apiUrl;
}

