"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.executeGraphQLRequest = executeGraphQLRequest;
exports.fetchAgencyUrl = fetchAgencyUrl;
const axios_1 = __importDefault(require("axios"));
const debug_1 = require("./debug");
const auth_1 = require("./auth");
const utils_1 = require("./utils");
const RETRY_DELAY_MS = 5000;
function checkRateLimit(response) {
    const rateLimitRemaining = parseInt(response.headers['x-ratelimit-remaining'] || '0', 10);
    const rateLimitTotal = parseInt(response.headers['x-ratelimit-limit'] || '100', 10);
    const resetTime = parseInt(response.headers['x-ratelimit-reset'] || '15', 10);
    const remainingPercentage = (rateLimitRemaining / rateLimitTotal) * 100;
    if (response.headers['x-ratelimit-remaining'] && remainingPercentage <= 10) {
        (0, debug_1.debug)(`WARNING: Rate limit nearly exhausted. ${rateLimitRemaining}/${rateLimitTotal} remaining. Waiting ${resetTime} seconds.`);
        return (0, utils_1.sleep)(resetTime * 1000);
    }
}
async function executeGraphQLRequest(options, maxRetries = 100) {
    const { endpoint, query, variables = {}, headers = {} } = options;
    let accessToken = await (0, auth_1.getAccessToken)();
    const payload = { query, variables };
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const response = await axios_1.default.post(endpoint, payload, {
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
        }
        catch (error) {
            if (axios_1.default.isAxiosError(error)) {
                // handle 429 (Rate Limit) errors
                if (error.response?.status === 429) {
                    const resetTime = parseInt(error.response.headers['x-ratelimit-reset'], 10);
                    (0, debug_1.debug)(`[Attempt ${attempt}] Rate limited (429). Waiting ${resetTime} seconds.`);
                    await (0, utils_1.sleep)(resetTime * 1000);
                    continue;
                }
                // handle 502 (Bad Gateway) errors
                if (error.response?.status === 502) {
                    (0, debug_1.debug)(`[Attempt ${attempt}] Bad Gateway (502). Retrying.`);
                    await (0, utils_1.sleep)(RETRY_DELAY_MS * attempt);
                    continue;
                }
                // handle 504 (Gateway Timeout) errors
                if (error.response?.status === 504) {
                    (0, debug_1.debug)(`[Attempt ${attempt}] Gateway Timeout (504). Retrying.`);
                    await (0, utils_1.sleep)(RETRY_DELAY_MS * attempt);
                    continue;
                }
                // handle 401 (Unauthorized) errors
                if (error.response?.status === 401) {
                    (0, debug_1.debug)(`[Attempt ${attempt}] Unauthorized (401). Retrying.`);
                    await (0, utils_1.sleep)(RETRY_DELAY_MS * attempt);
                    accessToken = await (0, auth_1.getAccessToken)(true);
                    continue;
                }
                (0, debug_1.debug)('Axios Error fetching data:', error.response?.data, 'Payload:', payload);
            }
            if (attempt === maxRetries) {
                if (axios_1.default.isAxiosError(error)) {
                    (0, debug_1.debug)('Axios Error fetching data:', error.response?.data);
                }
                else if (error instanceof Error) {
                    (0, debug_1.debug)('Error fetching data:', error.message);
                }
                else {
                    (0, debug_1.debug)('General Error fetching data:', String(error));
                }
                throw error;
            }
            await (0, utils_1.sleep)(RETRY_DELAY_MS * attempt);
        }
    }
    throw new Error('Max retries exceeded');
}
async function fetchAgencyUrl(agencyName) {
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
    const agency = data.agencies.find((a) => a.name === agencyName);
    if (!agency) {
        throw new Error(`No agency found matching AGENCY_NAME: "${agencyName}" in response: ${JSON.stringify(data)}`);
    }
    (0, debug_1.debug)('agency apiUrl', agency.apiUrl);
    return agency.apiUrl;
}
