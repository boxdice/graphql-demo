import Debug from "debug";

export const debug = (...messages: any[]) => {
    const timestamp = new Date().toLocaleString('en-AU', { timeZone: 'Australia/Melbourne' });
    Debug("App")(`[${timestamp}]`, ...messages);
};