import { Pool } from 'pg';
import { executeGraphQLRequest } from '../../graphql';
import {
  getAgencyUrl,
  assertEqual,
  assertDefined,
  fetchActiveSalesListing,
} from '../helpers';

export const name = 'GenerateReaXml';

export async function run(pool: Pool): Promise<void> {
  const agencyUrl = await getAgencyUrl();

  // ── Fetch an active sales listing ──
  const listing = await fetchActiveSalesListing(pool);
  console.log(`  Sales listing: ${listing.id} (status: ${listing.status})`);

  // ── Generate REA XML ──
  console.log('  Generating REA XML...');

  const mutation = `
    mutation generateReaXml($salesListingId: ID) {
      generateReaXml(salesListingId: $salesListingId) {
        url
        expiresAt
        error
      }
    }
  `;

  const result = await executeGraphQLRequest({
    endpoint: agencyUrl,
    query: mutation,
    variables: { salesListingId: listing.id },
  }, 1);

  const { url, error } = result.generateReaXml;
  assertEqual('error should be null', error, null);
  assertDefined('url should exist', url);

  console.log(`    URL: ${url}`);
}
