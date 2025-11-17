"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sleep = sleep;
exports.toPlural = toPlural;
const pluralize = require('pluralize');
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
function toPlural(name) {
    const lowerCased = name.charAt(0).toLowerCase() + name.slice(1);
    let plural = pluralize(lowerCased);
    if (plural === lowerCased) {
        plural = lowerCased + 's';
    }
    return plural;
}
