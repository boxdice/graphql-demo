import { Pool } from 'pg';
import { executeGraphQLRequest } from '../../graphql';
import {
  getAgencyUrl,
  fetchActiveSalesListing,
  fetchActiveConsultant,
  assertEqual,
  assertDefined,
} from '../helpers';

export const name = 'SalesListingMarkSold';

export async function run(pool: Pool): Promise<void> {
  const agencyUrl = await getAgencyUrl();
  const salesListing = await fetchActiveSalesListing(pool);
  const consultant = await fetchActiveConsultant(pool);

  // ── Mark Sales Listing as Sold ──
  console.log('  Marking sales listing as sold...');

  const attributes = {
    salesListingId: Number(salesListing.id),
    consultantId: Number(consultant.id),
    keepInspections: 'false',
  };

  const mutation = `
    mutation salesListingMarkSold($attributes: SalesListingSoldAttributes!) {
      salesListingMarkSold(attributes: $attributes) {
        salesListing {
          id
          status
        }
        error
      }
    }
  `;

  const result = await executeGraphQLRequest({
    endpoint: agencyUrl,
    query: mutation,
    variables: { attributes },
  }, 1);

  const { salesListing: updatedListing, error } = result.salesListingMarkSold;
  assertEqual('error should be null', error, null);
  assertDefined('salesListing should exist', updatedListing);
  assertDefined('salesListing.id should exist', updatedListing.id);

  console.log(`  Sales listing ${updatedListing.id} marked as sold (status: ${updatedListing.status})`);
}
