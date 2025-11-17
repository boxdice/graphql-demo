"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAccessToken = getAccessToken;
const axios_1 = __importDefault(require("axios"));
let accessToken;
let tokenExpiry;
async function getAccessToken(forceRefresh = false) {
    const tokenEndpoint = process.env.TOKEN_ENDPOINT;
    const clientId = process.env.CLIENT_ID;
    const clientSecret = process.env.CLIENT_SECRET;
    if (!tokenEndpoint || !clientId || !clientSecret) {
        throw new Error('Missing OAuth2 configuration in environment variables.');
    }
    if (accessToken && tokenExpiry && Date.now() < tokenExpiry && !forceRefresh) {
        return accessToken;
    }
    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    try {
        const response = await axios_1.default.post(tokenEndpoint, {
            grant_type: 'client_credentials'
        }, {
            headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
        });
        accessToken = response.data.access_token;
        const expiresIn = response.data.expires_in;
        tokenExpiry = Date.now() + expiresIn * 1000;
        return accessToken;
    }
    catch (error) {
        console.error('Error obtaining access token:', error.response?.data || error.message);
        throw error;
    }
}
