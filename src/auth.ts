import axios, { AxiosError } from 'axios';
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

  } catch (error: unknown) {
    console.error('Error obtaining access token:', (error as AxiosError).response?.data || (error as Error).message);
    throw error;
  }
}
