import { Pool } from 'pg';
import { faker } from '@faker-js/faker';
import { executeGraphQLRequest } from '../../graphql';
import {
  getAgencyUrl,
  fetchActiveSalesListing,
  assertEqual,
  assertDefined,
} from '../helpers';

export const name = 'UploadPresign';

export async function run(pool: Pool): Promise<void> {
  const agencyUrl = await getAgencyUrl();
  const salesListing = await fetchActiveSalesListing(pool);

  // ── Get presigned upload URL ──
  console.log('  Requesting presigned upload URL...');

  const createData = {
    salesListingId: Number(salesListing.id),
    filename: `${faker.string.uuid()}.jpg`,
    contentType: 'image/jpeg',
  };

  const mutation = `
    mutation uploadPresign($attributes: UploadPresignAttributes!) {
      uploadPresign(attributes: $attributes) {
        uploadUrl
        expiresAt
        error
      }
    }
  `;

  const result = await executeGraphQLRequest({
    endpoint: agencyUrl,
    query: mutation,
    variables: { attributes: createData },
  }, 1);

  const { uploadUrl, expiresAt, error } = result.uploadPresign;
  assertEqual('error should be null', error, null);
  assertDefined('uploadUrl should exist', uploadUrl);
  assertDefined('expiresAt should exist', expiresAt);

  console.log(`  Presigned URL received (expires at: ${expiresAt})`);
}
