import axios, { AxiosResponse } from 'axios';
import { debug } from './debug';
import { getAccessToken } from './auth';
import { sleep } from './utils';

const RETRY_DELAY_MS = 5000;

function parseResetTime(resetTimeHeader: string | undefined, defaultTime = 15): number {
  // parse the reset time, ensuring it's a positive number (Note: server is returning invalid reset time)
  if (resetTimeHeader) {
    // check if header looks like a valid number (length < 5)
    if (resetTimeHeader.length < 5) {
      const parsedTime = parseInt(resetTimeHeader, 10);
      return Math.max(defaultTime, Math.abs(parsedTime));
    }
  }
  
  // return default if header is still broken
  return defaultTime;
}

function checkRateLimit(response: AxiosResponse): Promise<void> | undefined {
  const rateLimitRemaining: number = parseInt(response.headers['x-ratelimit-remaining'] || '0', 10);
  const rateLimitTotal: number = parseInt(response.headers['x-ratelimit-limit'] || '100', 10);
  const remainingPercentage: number = (rateLimitRemaining / rateLimitTotal) * 100;

  if (response.headers['x-ratelimit-remaining'] && remainingPercentage <= 10) {
    const resetTime = parseResetTime(response.headers['x-ratelimit-reset']);
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
  maxRetries: number = 3
): Promise<any> {
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

      await checkRateLimit(response);
      return response.data.data;
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        // handle 429 (Rate Limit) errors
        if (error.response?.status === 429) {
          const resetTime = parseResetTime(error.response.headers['x-ratelimit-reset']);
          
          debug(`[Attempt ${attempt}] Rate limited (429). Waiting ${resetTime} seconds.`);
          
          await sleep(resetTime * 1000);
          continue;
        }

        // handle 502 (Gateway Timeout) errors 
        if (error.response?.status === 502) {
          debug(`[Attempt ${attempt}] Bad Gateway (502). Retrying.`);
          await sleep(RETRY_DELAY_MS * attempt);
          continue;
        }
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

