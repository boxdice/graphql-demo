import { Pool } from 'pg';
import { executeGraphQLRequest } from '../../graphql';
import {
  getAgencyUrl,
  fetchRentalAppraisal,
  fetchActiveConsultants,
  assertEqual,
  assertDefined,
} from '../helpers';

export const name = 'RentalListingUpdate';

export async function run(pool: Pool): Promise<void> {
  const agencyUrl = await getAgencyUrl();

  const rentalListing = await fetchRentalAppraisal(pool);
  console.log(`  Using rental listing: ${rentalListing.id}`);

  const consultants = await fetchActiveConsultants(pool, 3);
  console.log(`  Using consultants: ${consultants.map(c => c.id).join(', ')}`);

  // ── Step 1: Update basic fields ──
  console.log('  Updating rental listing (basic fields)...');

  const basicData = {
    url: 'https://example.com/rental-listing',
    virtualTourUrl: 'https://example.com/virtual-tour',
    videoLinkUrl: 'https://example.com/video',
    websiteStatus: 'CURRENT',
  };

  const basicResult = await executeGraphQLRequest({
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
    variables: { id: rentalListing.id, attributes: basicData },
  }, 1);

  const { rentalListing: basicUpdated, error: basicError } = basicResult.rentalListingUpdate;
  assertEqual('basic update error', basicError, null);
  assertDefined('updated rentalListing', basicUpdated);
  assertEqual('updated id', String(basicUpdated.id), String(rentalListing.id));
  assertEqual('updated url', basicUpdated.url, basicData.url);
  console.log(`  Rental listing updated: ${basicUpdated.id}`);

  // ── Step 2: Update advertising consultants ──
  console.log('  Updating rental listing (advertising consultants)...');

  const consultantData: Record<string, string> = {
    advConsultant1Id: consultants[0].id,
  };
  if (consultants.length > 1) consultantData.advConsultant2Id = consultants[1].id;
  if (consultants.length > 2) consultantData.advConsultant3Id = consultants[2].id;

  const consultantResult = await executeGraphQLRequest({
    endpoint: agencyUrl,
    query: `
      mutation rentalListingUpdate($id: ID!, $attributes: RentalListingUpdateAttributes!) {
        rentalListingUpdate(id: $id, attributes: $attributes) {
          rentalListing {
            id
            advertisingConsultant1Id
            advertisingConsultant2Id
            advertisingConsultant3Id
          }
          error
        }
      }
    `,
    variables: { id: rentalListing.id, attributes: consultantData },
  }, 1);

  const { rentalListing: consultantUpdated, error: consultantError } = consultantResult.rentalListingUpdate;
  assertEqual('consultant update error', consultantError, null);
  assertDefined('consultant updated rentalListing', consultantUpdated);
  assertEqual('advConsultant1Id', String(consultantUpdated.advertisingConsultant1Id), String(consultants[0].id));
  if (consultants.length > 1) {
    assertEqual('advConsultant2Id', String(consultantUpdated.advertisingConsultant2Id), String(consultants[1].id));
  }
  if (consultants.length > 2) {
    assertEqual('advConsultant3Id', String(consultantUpdated.advertisingConsultant3Id), String(consultants[2].id));
  }
  console.log(`  Advertising consultants updated: ${Object.values(consultantData).join(', ')}`);
}
