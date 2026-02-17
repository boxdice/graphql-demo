import axios, { AxiosResponse } from 'axios';
import { debug } from './debug';
import { getAccessToken } from './auth';
import { sleep } from './utils';

const RETRY_DELAY_MS = 5000;

function checkRateLimit(response: AxiosResponse): Promise<void> | undefined {
  const rateLimitRemaining: number = parseInt(response.headers['x-ratelimit-remaining'] || '0', 10);
  const rateLimitTotal: number = parseInt(response.headers['x-ratelimit-limit'] || '100', 10);
  const resetTime = parseInt(response.headers['x-ratelimit-reset'] || '15', 10);
  const remainingPercentage: number = (rateLimitRemaining / rateLimitTotal) * 100;

  if (response.headers['x-ratelimit-remaining'] && remainingPercentage <= 10) {
    debug(`WARNING: Rate limit nearly exhausted. ${rateLimitRemaining}/${rateLimitTotal} remaining. Waiting ${resetTime} seconds.`);
    return sleep(resetTime * 1000);
  }
}

export async function executeGraphQLRequest(
  options: {
    endpoint: string;
    query: string;
    variables?: Record<string, any>;
    headers?: Record<string, string>;
  },
  maxRetries: number = 100
): Promise<any> {
  const { endpoint, query, variables = {}, headers = {} } = options;
  let accessToken = await getAccessToken();
  const payload = { query, variables };

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await axios.post(endpoint, payload, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          ...headers,
        },
      });

      await checkRateLimit(response);

      if (response.data.errors) {
        console.log('query', query);
        console.log('variables', variables);
        console.log('GraphQL errors:', response.data.errors);
        throw new Error(`GraphQL errors: ${JSON.stringify(response.data.errors)}`);
      }
      
      if (!response.data.data) {
        console.log('Response data is undefined/null');
        throw new Error('GraphQL response data is undefined or null');
      }

      response.data.data.xRequestId = response.headers['x-request-id'];
      return response.data.data;
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        // handle 429 (Rate Limit) errors
        if (error.response?.status === 429) {
          const resetTime = parseInt(error.response.headers['x-ratelimit-reset'], 10);

          debug(`[Attempt ${attempt}] Rate limited (429). Waiting ${resetTime} seconds.`);

          await sleep(resetTime * 1000);
          continue;
        }

        // handle 502 (Bad Gateway) errors
        if (error.response?.status === 502) {
          debug(`[Attempt ${attempt}] Bad Gateway (502). Retrying.`);
          await sleep(RETRY_DELAY_MS * attempt);
          continue;
        }

        // handle 504 (Gateway Timeout) errors
        if (error.response?.status === 504) {
          debug(`[Attempt ${attempt}] Gateway Timeout (504). Retrying.`);
          await sleep(RETRY_DELAY_MS * attempt);
          continue;
        }

        // handle 401 (Unauthorized) errors
        if (error.response?.status === 401) {
          debug(`[Attempt ${attempt}] Unauthorized (401). Retrying.`);
          await sleep(RETRY_DELAY_MS * attempt);
          accessToken = await getAccessToken(true);
          continue;
        }

        console.log(`[DEBUG] Axios error details:`);
        console.log(`  Status: ${error.response?.status}`);
        console.log(`  Status Text: ${error.response?.statusText}`);
        console.log(`  Error Code: ${error.code}`);
        console.log(`  Error Message: ${error.message}`);
        console.log(`  URL: ${error.config?.url}`);
        console.log(`  Response Headers:`, JSON.stringify(error.response?.headers, null, 2));
        console.log(`  Response Data:`, JSON.stringify(error.response?.data, null, 2));
        console.log(`  Query:`, query.trim().substring(0, 100));

      }

      if (attempt === maxRetries) {
        if (axios.isAxiosError(error)) {
          debug('Axios Error fetching data:', error.response?.data);
        } else if (error instanceof Error) {
          debug('Error fetching data:', error.message);
        } else {
          debug('General Error fetching data:', String(error));
        }
        throw error;
      }

      await sleep(RETRY_DELAY_MS * attempt);
    }
  }

  throw new Error('Max retries exceeded');
}

export async function fetchAgencyUrl(agencyName: string, agencyId?: string): Promise<string> {
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

  const agency = agencyId
    ? data.agencies.find((a: { id: string }) => a.id === agencyId)
    : data.agencies.find((a: { name: string }) => a.name === agencyName);
  if (!agency) {
    const identifier = agencyId ? `AGENCY_ID: "${agencyId}"` : `AGENCY_NAME: "${agencyName}"`;
    throw new Error(`No agency found matching ${identifier} in response: ${JSON.stringify(data)}`);
  }

  let apiUrl = agency.apiUrl;

  // The developer API may return a URL without the correct port (e.g. port 80 instead of 3000).
  // Use DEVELOPER_GRAPHQL_ENDPOINT to derive the correct host and port.
  if (process.env.DEVELOPER_GRAPHQL_ENDPOINT) {
    const devUrl = new URL(process.env.DEVELOPER_GRAPHQL_ENDPOINT);
    const agencyUrlParsed = new URL(apiUrl);
    agencyUrlParsed.host = devUrl.host;
    apiUrl = agencyUrlParsed.toString();
  }

  debug('agency apiUrl', apiUrl);
  return apiUrl;
}

