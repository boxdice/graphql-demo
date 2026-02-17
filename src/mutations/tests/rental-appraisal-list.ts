import { Pool } from 'pg';
import { executeGraphQLRequest } from '../../graphql';
import {
  getAgencyUrl,
  fetchRentalAppraisal,
  assertEqual,
  assertDefined,
} from '../helpers';

export const name = 'RentalAppraisalList';

export async function run(pool: Pool): Promise<void> {
  const agencyUrl = await getAgencyUrl();
  const rentalAppraisal = await fetchRentalAppraisal(pool);

  // ── List (promote) a rental appraisal to rental listing ──
  console.log('  Promoting rental appraisal to listing...');

  const mutation = `
    mutation rentalAppraisalList($propertyId: ID!, $rentalAppraisalId: ID!) {
      rentalAppraisalList(propertyId: $propertyId, rentalAppraisalId: $rentalAppraisalId) {
        rentalListing {
          id
        }
        error
      }
    }
  `;

  const result = await executeGraphQLRequest({
    endpoint: agencyUrl,
    query: mutation,
    variables: {
      propertyId: rentalAppraisal.propertyId,
      rentalAppraisalId: rentalAppraisal.id,
    },
  }, 1);

  const { rentalListing, error } = result.rentalAppraisalList;
  assertEqual('error should be null', error, null);
  assertDefined('rentalListing should exist', rentalListing);
  assertDefined('rentalListing.id should exist', rentalListing.id);

  console.log(`  Rental listing created with id: ${rentalListing.id}`);
}
