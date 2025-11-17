"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.debug = void 0;
const debug_1 = __importDefault(require("debug"));
const debug = (...messages) => {
    const timestamp = new Date().toLocaleString('en-AU', { timeZone: 'Australia/Melbourne' });
    const processNum = process.env.PROCESS_NUM || '1';
    (0, debug_1.default)("App")(`[${timestamp}] [${processNum}]`, ...messages);
};
exports.debug = debug;
