import { Pool } from 'pg';
import { faker } from '@faker-js/faker';
import { executeGraphQLRequest } from '../../graphql';
import {
  getAgencyUrl,
  fetchContacts,
  fetchActiveSalesListing,
  assertEqual,
  assertDefined,
} from '../helpers';

export const name = 'AmlDueDiligenceCheck Create → Update → AssignListing → RemoveListing';

export async function run(pool: Pool): Promise<void> {
  const agencyUrl = await getAgencyUrl();
  const contacts = await fetchContacts(pool, 1);
  const salesListing = await fetchActiveSalesListing(pool);

  // ── Step 1: Create AML Due Diligence Check ──
  console.log('  Creating AML due diligence check...');

  const createData = {
    contactId: Number(contacts[0].id),
    status: 'in_progress',
    source: faker.lorem.word(),
    note: faker.lorem.sentence(),
  };

  const createMutation = `
    mutation amlDueDiligenceCheckCreate($attributes: AmlDueDiligenceCheckAttributes!) {
      amlDueDiligenceCheckCreate(attributes: $attributes) {
        amlDueDiligenceCheck {
          id
          status
          source
          note
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

  const { amlDueDiligenceCheck, error: createError } = createResult.amlDueDiligenceCheckCreate;
  assertEqual('create error should be null', createError, null);
  assertDefined('amlDueDiligenceCheck should exist', amlDueDiligenceCheck);
  assertDefined('amlDueDiligenceCheck.id should exist', amlDueDiligenceCheck.id);

  console.log(`  AML check created with id: ${amlDueDiligenceCheck.id}`);

  // Verify created data
  console.log('  Verifying created AML check...');
  // source is overridden by the server to "manual", so only assert on note
  assertEqual('note', amlDueDiligenceCheck.note, createData.note);

  // ── Step 2: Update AML Due Diligence Check ──
  console.log('  Updating AML due diligence check...');

  const updateData = {
    note: faker.lorem.sentence(),
    status: 'completed',
  };

  const updateMutation = `
    mutation amlDueDiligenceCheckUpdate($id: ID!, $attributes: AmlDueDiligenceCheckAttributes!) {
      amlDueDiligenceCheckUpdate(id: $id, attributes: $attributes) {
        amlDueDiligenceCheck {
          id
          status
          note
        }
        error
      }
    }
  `;

  const updateResult = await executeGraphQLRequest({
    endpoint: agencyUrl,
    query: updateMutation,
    variables: { id: amlDueDiligenceCheck.id, attributes: updateData },
  }, 1);

  const { amlDueDiligenceCheck: updated, error: updateError } = updateResult.amlDueDiligenceCheckUpdate;
  assertEqual('update error should be null', updateError, null);
  assertDefined('updated amlDueDiligenceCheck should exist', updated);

  console.log('  Verifying updated AML check...');
  assertEqual('updated note', updated.note, updateData.note);

  // ── Step 3: Assign Listing ──
  console.log('  Assigning listing to AML check...');

  const assignMutation = `
    mutation amlDueDiligenceCheckAssignListing($amlDueDiligenceCheckId: ID!, $salesListingId: ID!) {
      amlDueDiligenceCheckAssignListing(amlDueDiligenceCheckId: $amlDueDiligenceCheckId, salesListingId: $salesListingId) {
        error
      }
    }
  `;

  const assignResult = await executeGraphQLRequest({
    endpoint: agencyUrl,
    query: assignMutation,
    variables: {
      amlDueDiligenceCheckId: amlDueDiligenceCheck.id,
      salesListingId: salesListing.id,
    },
  }, 1);

  assertEqual('assign error should be null', assignResult.amlDueDiligenceCheckAssignListing.error, null);
  console.log('  Listing assigned successfully');

  // ── Step 4: Remove Listing ──
  console.log('  Removing listing from AML check...');

  const removeMutation = `
    mutation amlDueDiligenceCheckRemoveListing($amlDueDiligenceCheckId: ID!, $salesListingId: ID!) {
      amlDueDiligenceCheckRemoveListing(amlDueDiligenceCheckId: $amlDueDiligenceCheckId, salesListingId: $salesListingId) {
        error
      }
    }
  `;

  const removeResult = await executeGraphQLRequest({
    endpoint: agencyUrl,
    query: removeMutation,
    variables: {
      amlDueDiligenceCheckId: amlDueDiligenceCheck.id,
      salesListingId: salesListing.id,
    },
  }, 1);

  assertEqual('remove error should be null', removeResult.amlDueDiligenceCheckRemoveListing.error, null);
  console.log('  Listing removed successfully');
}
