import axios, { AxiosResponse, AxiosError } from 'axios';
import { debug } from './debug';
import { getAccessToken } from './auth';
import { sleep } from './utils';

function parseResetTime(resetTimeHeader: string | undefined, defaultTime = 15): number {
  // parse the reset time, ensuring it's a positive number (server is returning invalid reset time atm)
  if (resetTimeHeader) {
    // check if header looks like a valid number (length < 4)
    if (resetTimeHeader.length < 4) {
      const parsedTime = parseInt(resetTimeHeader, 10);
      return Math.max(defaultTime, Math.abs(parsedTime));
    }
  }
  
  // Return default if no valid header or parsing fails
  return defaultTime;
}

export async function executeGraphQLRequest(
  options: {
    endpoint: string;
    query: string;
    variables?: Record<string, any>;
    headers?: Record<string, string>;
  },
  maxRetries = 3
) {
  const { endpoint, query, variables = {}, headers = {} } = options;
  const accessToken = await getAccessToken();
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

      // Check rate limit remaining before returning
      const rateLimitRemaining = parseInt(response.headers['x-ratelimit-remaining'] || '0', 10);
      const rateLimitTotal = parseInt(response.headers['x-ratelimit-limit'] || '100', 10);
      const remainingPercentage = (rateLimitRemaining / rateLimitTotal) * 100;

      if (remainingPercentage <= 10) {
        const resetTime = parseResetTime(response.headers['x-ratelimit-reset']);
        debug(`WARNING: Rate limit nearly exhausted. ${rateLimitRemaining}/${rateLimitTotal} remaining. Waiting ${resetTime} seconds.`);
        await sleep(resetTime * 1000);
      }

      return response.data.data;
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        // Specifically handle 429 (Rate Limit) errors
        if (error.response?.status === 429) {
          const resetTime = parseResetTime(error.response.headers['x-ratelimit-reset']);
          
          debug(`[Attempt ${attempt}] Rate limited (429). Waiting ${resetTime} seconds.`);
          
          // Log rate limit headers
          logRateLimitHeaders(error.response);
          
          // Wait and continue
          await sleep(resetTime * 1000);
          continue;
        }

        // Handle 502 errors
        if (error.response?.status === 502) {
          debug(`[Attempt ${attempt}] Bad Gateway (502). Retrying.`);
          await sleep(5000 * attempt);
          continue;
        }
      }

      if (attempt === maxRetries) {
        if (axios.isAxiosError(error)) {
          debug('Axios Error fetching data:', error.response?.data);
          logRateLimitHeaders(error.response);
        } else if (error instanceof Error) {
          debug('Error fetching data:', error.message);
        } else {
          debug('General Error fetching data:', String(error));
        }
        throw error;
      }

      await sleep(5000 * attempt);
    }
  }

  throw new Error('Max retries exceeded');
}

// Helper function to log rate limit headers
function logRateLimitHeaders(response?: AxiosResponse) {
  if (!response) return;

  const headers = response.headers;
  debug('Rate Limit Headers:', {
    'X-RateLimit-Limit': headers['x-ratelimit-limit'],
    'X-RateLimit-Remaining': headers['x-ratelimit-remaining'],
    'X-RateLimit-Reset': headers['x-ratelimit-reset'],
    'X-ConcurrencyLimit-Limit': headers['x-concurrencylimit-limit'],
    'X-ConcurrencyLimit-Remaining': headers['x-concurrencylimit-remaining']
  });
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

