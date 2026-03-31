import { Pool } from 'pg';
import { executeGraphQLRequest } from '../../graphql';
import {
  getAgencyUrl,
  fetchRentalAppraisal,
  assertEqual,
  assertDefined,
} from '../helpers';

export const name = 'RentalListingUpdate';

export async function run(pool: Pool): Promise<void> {
  const agencyUrl = await getAgencyUrl();

  const rentalListing = await fetchRentalAppraisal(pool);
  console.log(`  Using rental listing: ${rentalListing.id}`);

  // ── Update RentalListing ──
  console.log('  Updating rental listing...');

  const updateData = {
    url: 'https://example.com/rental-listing',
    virtualTourUrl: 'https://example.com/virtual-tour',
    websiteStatus: 'CURRENT',
  };

  const updateResult = await executeGraphQLRequest({
    endpoint: agencyUrl,
    query: `
      mutation rentalListingUpdate($id: ID!, $attributes: RentalListingUpdateAttributes!) {
        rentalListingUpdate(id: $id, attributes: $attributes) {
          rentalListing {
            id
            url
          }
          error
        }
      }
    `,
    variables: { id: rentalListing.id, attributes: updateData },
  }, 1);

  const { rentalListing: updated, error: updateError } = updateResult.rentalListingUpdate;
  assertEqual('update error', updateError, null);
  assertDefined('updated rentalListing', updated);
  assertEqual('updated id', String(updated.id), String(rentalListing.id));
  assertEqual('updated url', updated.url, updateData.url);
  console.log(`  Rental listing updated: ${updated.id}`);
}
