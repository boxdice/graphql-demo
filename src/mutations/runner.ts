import { Pool } from 'pg';
import { getDb } from './helpers';

interface TestModule {
  name: string;
  run: (pool: Pool) => Promise<void>;
}

// Register tests here
import * as enquiryCreate from './tests/enquiry-create';
import * as appraisalToListing from './tests/appraisal-to-listing';
import * as salesListingCreate from './tests/sales-listing-create';
import * as contactCreate from './tests/contact-crud';
import * as commentCrud from './tests/comment-crud';
import * as appraisalUpdate from './tests/appraisal-update';
import * as amlDueDiligence from './tests/aml-due-diligence';
import * as campaignItemCreate from './tests/campaign-item-create';
// import * as rentalAppraisalList from './tests/rental-appraisal-list'; // Requires rental appraisal data — skipped for now
import * as salesListingMarkSold from './tests/sales-listing-mark-sold';
import * as salesVoucherUpdate from './tests/sales-voucher-update';
import * as uploadPresign from './tests/upload-presign';
import * as batchCreate from './tests/batch-create';
import * as propertyTagTypeCreate from './tests/property-tag-type-create';
import * as propertyCrud from './tests/property-crud';
import * as buyingCriteriaCreate from './tests/buying-criteria-create';
import * as leadFlowCreate from './tests/lead-flow-create';
import * as propertySoldOutsideCreate from './tests/property-sold-outside-create';
import * as generateReaXml from './tests/generate-rea-xml';
import * as listingTagTypeCrud from './tests/listing-tag-type-crud';
import * as endToEnd from './tests/end-to-end';

const tests: TestModule[] = [
  enquiryCreate,
  appraisalToListing,
  salesListingCreate,
  contactCreate,
  commentCrud,
  appraisalUpdate,
  amlDueDiligence,
  campaignItemCreate,
  salesListingMarkSold,
  salesVoucherUpdate,
  // rentalAppraisalList,
  uploadPresign,
  batchCreate,
  propertyTagTypeCreate,
  propertyCrud,
  leadFlowCreate,
  buyingCriteriaCreate,
  propertySoldOutsideCreate,
  listingTagTypeCrud,
  endToEnd,
];

async function main(): Promise<void> {
  const required = ['CLIENT_ID', 'CLIENT_SECRET', 'TOKEN_ENDPOINT', 'DEVELOPER_GRAPHQL_ENDPOINT', 'AGENCY_NAME'];
  for (const envVar of required) {
    if (!process.env[envVar]) {
      console.error(`Missing required environment variable: ${envVar}`);
      process.exit(1);
    }
  }

  const pool = await getDb();

  console.log(`\n=== Mutation Tests ===`);
  console.log(`Running ${tests.length} test(s)...\n`);

  let passed = 0;
  let failed = 0;
  const failures: { name: string; error: string }[] = [];

  for (const test of tests) {
    console.log(`[RUN]  ${test.name}`);
    const start = Date.now();
    try {
      await test.run(pool);
      const duration = ((Date.now() - start) / 1000).toFixed(2);
      console.log(`[PASS] ${test.name} (${duration}s)\n`);
      passed++;
    } catch (err: unknown) {
      const duration = ((Date.now() - start) / 1000).toFixed(2);
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[FAIL] ${test.name} (${duration}s)`);
      console.error(`       ${message}\n`);
      failed++;
      failures.push({ name: test.name, error: message });
    }
  }

  console.log('=== Results ===');
  console.log(`Passed: ${passed}  Failed: ${failed}  Total: ${tests.length}`);

  if (failures.length > 0) {
    console.log('\nFailures:');
    failures.forEach(f => console.log(`  - ${f.name}: ${f.error}`));
  } else {
    console.log('\nAll tests passed.');
  }

  await pool.end();
  process.exit(failed > 0 ? 1 : 0);
}

main();
