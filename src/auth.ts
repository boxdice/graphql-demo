import axios from 'axios';
import { debug } from './debug';

export interface Agency {
  name: string;
  token: string;
}

let accessToken: string; 
let tokenExpiry: number; 

export async function getAccessToken(): Promise<string> {
  const tokenEndpoint = process.env.TOKEN_ENDPOINT;
  const clientId = process.env.CLIENT_ID;
  const clientSecret = process.env.CLIENT_SECRET;

  if (!tokenEndpoint || !clientId || !clientSecret) {
    throw new Error('Missing OAuth2 configuration in environment variables.');
  }

  if (accessToken && tokenExpiry && Date.now() < tokenExpiry) {
    return accessToken;
  }

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  try {
    const response = await axios.post(
      tokenEndpoint,
      {
        grant_type: 'client_credentials'
      },
      {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    accessToken = response.data.access_token;
    const expiresIn = response.data.expires_in;
    tokenExpiry = Date.now() + expiresIn * 1000;

    return accessToken;

  } catch (error: any) {
    console.error('Error obtaining access token:', error.response?.data || error.message);
    throw error;
  }
}

export async function getAgencyToken(accessToken: string): Promise<string> {
  const agenciesEndpoint = process.env.AGENCIES_ENDPOINT;
  const agencyName = process.env.AGENCY_NAME;

  debug('fetching api token');
  
  if (!agenciesEndpoint || !agencyName) {
    throw new Error('Missing API token configuration in environment variables.');
  }

  try {
    const response = await axios.get(agenciesEndpoint, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

console.log('response.data', response.data.agencies);

    const agency = response.data.agencies.find((agency: Agency) => agency.name === agencyName);
    if (!agency) {
      throw new Error(`No agency found matching AGENCY_NAME: "${agencyName}" in response: ${response.data}`);
    }
    return agency.token;

  } catch (error: any) {
    console.error('Error fetching api token:', error.response?.data || error.message);
    throw error;
  }
} 