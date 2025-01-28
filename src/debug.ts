import Debug from "debug";

export const debug = (...messages: any[]): void => {
    const timestamp = new Date().toLocaleString('en-AU', { timeZone: 'Australia/Melbourne' });
    const processNum = process.env.PROCESS_NUM || '1';
    Debug("App")(`[${timestamp}] [${processNum}]`, ...messages);
};