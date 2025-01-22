import Debug from "debug";

export const debug = (...messages: any[]) => {
    const timestamp = new Date().toISOString();
    Debug("App")(`[${timestamp}]`, ...messages);
};