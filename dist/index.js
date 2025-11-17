"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.main = main;
const database_1 = require("./database");
const database_2 = require("./database");
const debug_1 = require("./debug");
const utils_1 = require("./utils");
const schema_1 = __importDefault(require("./schema"));
const graphql_1 = require("./graphql");
const lockedCollections = [];
let db = null;
const processNum = process.env.PROCESS_NUM || '1';
const processLockId = `process-${processNum}`;
const PAUSE_BETWEEN_REQUESTS = parseInt(process.env.PAUSE_BETWEEN_REQUESTS || '1000', 10);
/**
 * Main entry point
 */
async function main() {
    if (!process.env.SCHEMA_URL) {
        throw new Error('Missing SCHEMA_URL');
    }
    if (!process.env.AGENCY_NAME) {
        throw new Error('Missing AGENCY_NAME');
    }
    db = await (0, database_1.initDb)();
    while (true) {
        try {
            let collections = await (0, schema_1.default)(process.env.SCHEMA_URL);
            collections = filterCollections(collections, process.env.COLLECTION_TYPES);
            const agencyUrl = await (0, graphql_1.fetchAgencyUrl)(process.env.AGENCY_NAME);
            for (const collection of collections) {
                const { collectionType } = collection;
                const lockAcquired = await (0, database_2.acquireLock)(db, collectionType, processLockId);
                if (!lockAcquired) {
                    (0, debug_1.debug)(`Lock for collection "${collectionType}" not acquired. Skipping.`);
                    continue;
                }
                lockedCollections.push(collectionType);
                try {
                    await processCollection(agencyUrl, db, collection);
                }
                finally {
                    await (0, database_2.releaseLock)(db, collectionType, processLockId);
                    const index = lockedCollections.indexOf(collectionType);
                    if (index !== -1) {
                        lockedCollections.splice(index, 1);
                    }
                }
            }
            (0, debug_1.debug)('All discovered collections have been processed or skipped.');
        }
        catch (error) {
            (0, debug_1.debug)('Error in main:', error);
        }
        (0, debug_1.debug)('Sleeping for 10 minutes...');
        await (0, utils_1.sleep)(10 * 60 * 1000); // 10 minutes
    }
}
async function processCollection(agencyUrl, db, collection) {
    const { itemsBaseType, fields } = collection;
    await (0, database_1.ensureTable)(db, itemsBaseType, fields);
    const query = buildGraphQLQuery(itemsBaseType, fields);
    await fetchAndPersistPaginatedData(agencyUrl, db, collection.collectionType, itemsBaseType, query, fields);
}
function buildGraphQLQuery(baseType, fields) {
    const pluralName = (0, utils_1.toPlural)(baseType);
    const scalarFields = fields
        .filter((f) => f.isScalar || f.fieldType === 'ID')
        .map((f) => f.fieldName);
    return `
    query ${pluralName}($after: String, $limit: Int) {
      ${pluralName}(after: $after, limit: $limit) {
        cursor
        deletedIds
        hasMore
        ids
        items {
          ${scalarFields.join('\n')}
        }
      }
    }
  `;
}
async function fetchAndPersistPaginatedData(agencyUrl, db, collectionType, itemsBaseType, query, fields) {
    let after = await (0, database_1.getLastCursor)(db, collectionType);
    let hasMore = true;
    const limit = 1000;
    while (hasMore) {
        const startTime = Date.now();
        let data;
        try {
            data = await (0, graphql_1.executeGraphQLRequest)({
                endpoint: agencyUrl,
                query,
                variables: { after, limit },
            });
            const duration = ((Date.now() - startTime) / 1000).toFixed(2);
            (0, debug_1.debug)(`[xRequestId=${data.xRequestId}] - ${duration}s - Fetched ${itemsBaseType} after=${after} count=${data[(0, utils_1.toPlural)(itemsBaseType)].items.length}`);
        }
        catch (error) {
            (0, debug_1.debug)(`Error Fetching ${itemsBaseType} page after=${after} limit=${limit}`);
            throw error;
        }
        if (!data) {
            throw new Error(`No data returned for "${itemsBaseType}" query`);
        }
        const itemsData = data[(0, utils_1.toPlural)(itemsBaseType)];
        hasMore = itemsData.hasMore;
        after = itemsData.cursor;
        await Promise.all([
            (0, database_1.upsertItems)(db, itemsBaseType, fields, itemsData.items || []),
            (0, database_1.deleteItems)(db, itemsBaseType, itemsData.deletedIds || [])
        ]);
        await (0, database_1.updateCursor)(db, after, collectionType);
        await (0, utils_1.sleep)(PAUSE_BETWEEN_REQUESTS);
    }
    (0, debug_1.debug)(`Finished fetching all data for "${itemsBaseType}".`);
}
/**
 * Filter collections by comma separated list of collection types, e.g. "ContactActivityType,Property"
 */
function filterCollections(collections, collectionTypes) {
    if (!collectionTypes || collectionTypes.length === 0) {
        return collections;
    }
    (0, debug_1.debug)(`Filtering collections by COLLECTION_TYPES: ${collectionTypes}`);
    const allowedCollections = collectionTypes.split(',').map(s => s.trim() + 'Collection');
    return collections.filter(collection => {
        if (allowedCollections.includes(collection.collectionType)) {
            (0, debug_1.debug)(`Syncing ${collection.collectionType} permitted by COLLECTION_TYPES`);
            return true;
        }
        return false;
    });
}
main();
