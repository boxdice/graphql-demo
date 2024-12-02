import axios from 'axios';
import { debug } from './debug';

export interface Agency {
  agency_name: string;
  token: string;
}

export async function getAccessToken(): Promise<string> {
  const tokenEndpoint = process.env.TOKEN_ENDPOINT;
  const clientId = process.env.CLIENT_ID;
  const clientSecret = process.env.CLIENT_SECRET;

  debug('fetching access token');

  if (!tokenEndpoint || !clientId || !clientSecret) {
    throw new Error('Missing OAuth2 configuration in environment variables.');
  }

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  try {
    const response = await axios.post(
      `${tokenEndpoint}?grant_type=client_credentials`,
      {},
      {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    const accessToken = response.data.access_token;
    return accessToken;
  } catch (error: any) {
    console.error('Error obtaining access token:', error.response?.data || error.message);
    throw error;
  }
}

export async function getApiToken(accessToken: string): Promise<string> {
  const agenciesEndpoint = process.env.AGENCIES_ENDPOINT;
  const agencyName = process.env.AGENCY_NAME;

  debug('fetching access token');
  
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

    const agency = response.data.find((agency: Agency) => agency.agency_name === agencyName);
    if (!agency) {
      throw new Error(`No agency found matching AGENCY_NAME: ${agencyName}`);
    }
    return agency.token;

  } catch (error: any) {
    console.error('Error fetching API token:', error.response?.data || error.message);
    throw error;
  }
} 