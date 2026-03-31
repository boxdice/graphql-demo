import { Pool } from 'pg';
import { executeGraphQLRequest } from '../../graphql';
import {
  getAgencyUrl,
  assertEqual,
  assertDefined,
} from '../helpers';

export const name = 'SmsMessage Sync → Query';

export async function run(pool: Pool): Promise<void> {
  const agencyUrl = await getAgencyUrl();

  // ── Step 1: Verify SmsMessage table was created by sync ──
  console.log('  Checking SmsMessage table...');

  const tableRes = await pool.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'SmsMessage'
    ORDER BY ordinal_position
  `);
  const columns = tableRes.rows.map((r: any) => r.column_name);
  if (columns.length === 0) {
    throw new Error('SmsMessage table does not exist. Has the sync been run with SmsMessage collection?');
  }

  const expectedColumns = ['id', 'consultantId', 'contactId', 'cost', 'error', 'message', 'officeId', 'recipientMobile', 'scheduledAt', 'sender', 'sentAt', 'status', 'ts'];
  for (const col of expectedColumns) {
    if (!columns.includes(col)) {
      throw new Error(`Missing column "${col}" in SmsMessage table. Found: ${columns.join(', ')}`);
    }
  }
  console.log(`  SmsMessage table columns verified: ${expectedColumns.length} expected columns present`);

  // Check row count
  const countRes = await pool.query('SELECT COUNT(*) as count FROM "SmsMessage"');
  const syncedCount = parseInt(countRes.rows[0].count, 10);
  console.log(`  SmsMessage records synced: ${syncedCount}`);

  // ── Step 2: Query smsMessages collection ──
  console.log('  Querying smsMessages collection...');

  const collectionResult = await executeGraphQLRequest({
    endpoint: agencyUrl,
    query: `
      query smsMessages($limit: Int) {
        smsMessages(limit: $limit) {
          cursor
          hasMore
          ids
          deletedIds
          items {
            id
            consultantId
            contactId
            cost
            message
            recipientMobile
            sender
            sentAt
            status
            ts
          }
        }
      }
    `,
    variables: { limit: 5 },
  }, 1);

  const collection = collectionResult.smsMessages;
  assertDefined('smsMessages', collection);
  assertDefined('smsMessages.cursor', collection.cursor);
  assertDefined('smsMessages.items', collection.items);
  console.log(`  smsMessages returned ${collection.items.length} items, hasMore=${collection.hasMore}`);

  if (collection.items.length === 0) {
    console.log('  No SMS messages in this agency — skipping detailed query tests');
    return;
  }

  // Verify each item has an id and ts
  for (const item of collection.items) {
    assertDefined('item.id', item.id);
    assertDefined('item.ts', item.ts);
  }

  // ── Step 3: Query single SmsMessage by ID ──
  console.log('  Querying single smsMessage...');

  const sampleId = collection.items[0].id;

  const singleResult = await executeGraphQLRequest({
    endpoint: agencyUrl,
    query: `
      query smsMessage($id: ID!) {
        smsMessage(id: $id) {
          id
          consultantId
          contactId
          cost
          error
          message
          officeId
          recipientMobile
          scheduledAt
          sender
          sentAt
          status
          ts
        }
      }
    `,
    variables: { id: sampleId },
  }, 1);

  const smsMessage = singleResult.smsMessage;
  assertDefined('smsMessage', smsMessage);
  assertEqual('smsMessage id', String(smsMessage.id), String(sampleId));
  assertDefined('smsMessage ts', smsMessage.ts);
  console.log(`  smsMessage(id: ${sampleId}) returned: status=${smsMessage.status}, sender=${smsMessage.sender}`);

  // ── Step 4: Test pagination with cursor ──
  if (collection.hasMore) {
    console.log('  Testing pagination with cursor...');

    const page2Result = await executeGraphQLRequest({
      endpoint: agencyUrl,
      query: `
        query smsMessages($after: String, $limit: Int) {
          smsMessages(after: $after, limit: $limit) {
            cursor
            hasMore
            items { id }
          }
        }
      `,
      variables: { after: collection.cursor, limit: 5 },
    }, 1);

    const page2 = page2Result.smsMessages;
    assertDefined('page2', page2);
    assertDefined('page2.items', page2.items);
    console.log(`  Page 2 returned ${page2.items.length} items, hasMore=${page2.hasMore}`);

    // Ensure no overlap between pages
    const page1Ids = new Set(collection.items.map((i: any) => i.id));
    for (const item of page2.items) {
      if (page1Ids.has(item.id)) {
        throw new Error(`Duplicate item ${item.id} found across pages`);
      }
    }
    console.log('  No duplicate items across pages');
  }

  // ── Step 5: Verify synced data matches API ──
  if (syncedCount > 0) {
    console.log('  Verifying synced data matches API...');

    const verifyId = collection.items[0].id;
    const dbRes = await pool.query('SELECT id, status, sender, "recipientMobile", message FROM "SmsMessage" WHERE id = $1', [verifyId]);
    if (dbRes.rowCount === 0) {
      throw new Error(`SmsMessage ${verifyId} from API not found in local DB`);
    }

    const dbRow = dbRes.rows[0];
    const apiItem = collection.items[0];
    assertEqual('synced id', String(dbRow.id), String(apiItem.id));
    if (apiItem.status) assertEqual('synced status', dbRow.status, apiItem.status);
    if (apiItem.sender) assertEqual('synced sender', dbRow.sender, apiItem.sender);
    console.log(`  SmsMessage ${verifyId}: DB data matches API response`);
  }
}
