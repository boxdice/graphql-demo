import { Pool } from 'pg';
import { faker } from '@faker-js/faker';
import { executeGraphQLRequest } from '../../graphql';
import {
  getAgencyUrl,
  fetchActiveSalesListing,
  assertEqual,
  assertDefined,
} from '../helpers';

export const name = 'CampaignItemCreate';

export async function run(pool: Pool): Promise<void> {
  const agencyUrl = await getAgencyUrl();
  const salesListing = await fetchActiveSalesListing(pool);

  // ── Create Campaign Item ──
  console.log('  Creating campaign item...');

  const createData = {
    listingId: Number(salesListing.id),
    listingType: 'sale',
    externalCampaignItemId: faker.string.uuid(),
    cost: parseFloat(faker.commerce.price({ min: 100, max: 5000 })),
    productName: faker.commerce.productName(),
    externalProductId: faker.string.uuid(),
    supplierName: faker.company.name(),
  };

  const createMutation = `
    mutation campaignItemCreate($attributes: CampaignItemAttributes!) {
      campaignItemCreate(attributes: $attributes) {
        campaignItem {
          id
          externalCampaignItemId
          estimatedCost
          status
        }
        error
      }
    }
  `;

  const createResult = await executeGraphQLRequest({
    endpoint: agencyUrl,
    query: createMutation,
    variables: { attributes: createData },
  }, 1);

  const { campaignItem, error: createError } = createResult.campaignItemCreate;
  assertEqual('create error should be null', createError, null);
  assertDefined('campaignItem should exist', campaignItem);
  assertDefined('campaignItem.id should exist', campaignItem.id);

  console.log(`  Campaign item created with id: ${campaignItem.id}`);

  // Verify created data
  console.log('  Verifying created campaign item...');
  assertEqual('externalCampaignItemId', campaignItem.externalCampaignItemId, createData.externalCampaignItemId);
}
