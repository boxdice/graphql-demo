import { Pool } from 'pg';
import { executeGraphQLRequest } from '../../graphql';
import {
  getAgencyUrl,
  fetchUnusedProperties,
  fetchOffice,
  fetchActiveConsultants,
  fetchContacts,
  assertEqual,
  assertDefined,
} from '../helpers';

export const name = 'AppraisalCreate → AppraisalUpdate';

export async function run(pool: Pool): Promise<void> {
  const agencyUrl = await getAgencyUrl();
  // Fetch multiple unused properties — earlier tests may have consumed the first ones
  const properties = await fetchUnusedProperties(pool, 5);
  const property = properties[properties.length - 1];
  const office = await fetchOffice(pool);
  const consultants = await fetchActiveConsultants(pool, 2);
  const contacts = await fetchContacts(pool, 1);

  // ── Step 1: Create Appraisal ──
  console.log('  Creating appraisal...');

  const createData = {
    propertyId: Number(property.id),
    officeId: Number(office.id),
    consultantId: Number(consultants[0].id),
    consultant1Id: Number(consultants[0].id),
    contactIds: [Number(contacts[0].id)],
    apprPriceFrom: 500000,
    apprPriceTo: 600000,
  };

  const createMutation = `
    mutation appraisalCreate($attributes: AppraisalCreateAttributes!) {
      appraisalCreate(attributes: $attributes) {
        appraisal {
          id
          apprPriceFrom
          apprPriceTo
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

  const { appraisal, error: createError } = createResult.appraisalCreate;
  assertEqual('create error should be null', createError, null);
  assertDefined('appraisal should exist', appraisal);
  assertDefined('appraisal.id should exist', appraisal.id);

  console.log(`  Appraisal created with id: ${appraisal.id}`);

  // Verify created data
  console.log('  Verifying created appraisal...');
  assertEqual('apprPriceFrom', appraisal.apprPriceFrom, createData.apprPriceFrom);
  assertEqual('apprPriceTo', appraisal.apprPriceTo, createData.apprPriceTo);

  // ── Step 2: Update Appraisal ──
  console.log('  Updating appraisal...');

  const updateData = {
    id: appraisal.id,
    apprPriceFrom: 550000,
    apprPriceTo: 650000,
  };

  if (consultants.length > 1) {
    (updateData as any).consultant2Id = Number(consultants[1].id);
  }

  const updateMutation = `
    mutation appraisalUpdate($attributes: AppraisalUpdateAttributes!) {
      appraisalUpdate(attributes: $attributes) {
        appraisal {
          id
          apprPriceFrom
          apprPriceTo
        }
        error
      }
    }
  `;

  const updateResult = await executeGraphQLRequest({
    endpoint: agencyUrl,
    query: updateMutation,
    variables: { attributes: updateData },
  }, 1);

  const { appraisal: updated, error: updateError } = updateResult.appraisalUpdate;
  assertEqual('update error should be null', updateError, null);
  assertDefined('updated appraisal should exist', updated);

  console.log('  Verifying updated appraisal...');
  assertEqual('updated apprPriceFrom', updated.apprPriceFrom, updateData.apprPriceFrom);
  assertEqual('updated apprPriceTo', updated.apprPriceTo, updateData.apprPriceTo);
}
