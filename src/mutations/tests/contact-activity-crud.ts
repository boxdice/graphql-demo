import { Pool } from 'pg';
import { executeGraphQLRequest } from '../../graphql';
import {
  getAgencyUrl,
  fetchContacts,
  fetchActiveConsultant,
  assertEqual,
  assertDefined,
} from '../helpers';

export const name = 'ContactActivityCreate → ContactActivityUpdate';

export async function run(pool: Pool): Promise<void> {
  const agencyUrl = await getAgencyUrl();
  const contacts = await fetchContacts(pool, 1);
  const consultant = await fetchActiveConsultant(pool);

  // ── Step 1: Create ContactActivity ──
  console.log('  Creating contact activity...');

  const createData = {
    contactId: Number(contacts[0].id),
    consultantId: Number(consultant.id),
    startDate: '2025-06-01',
    endDate: '2025-06-02',
  };

  const createMutation = `
    mutation contactActivityCreate($attributes: ContactActivityAttributes!) {
      contactActivityCreate(attributes: $attributes) {
        contactActivity {
          id
          startDate
          endDate
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

  const { contactActivity, error: createError } = createResult.contactActivityCreate;
  assertEqual('create error should be null', createError, null);
  assertDefined('contactActivity should exist', contactActivity);
  assertDefined('contactActivity.id should exist', contactActivity.id);

  console.log(`  ContactActivity created with id: ${contactActivity.id}`);

  // Verify created data
  console.log('  Verifying created contact activity...');
  assertEqual('startDate', contactActivity.startDate, createData.startDate);
  assertEqual('endDate', contactActivity.endDate, createData.endDate);

  // ── Step 2: Update ContactActivity ──
  console.log('  Updating contact activity...');

  const updateData = {
    startDate: '2025-07-01',
    endDate: '2025-07-15',
  };

  const updateMutation = `
    mutation contactActivityUpdate($id: ID!, $attributes: ContactActivityAttributes!) {
      contactActivityUpdate(id: $id, attributes: $attributes) {
        contactActivity {
          id
          startDate
          endDate
        }
        error
      }
    }
  `;

  const updateResult = await executeGraphQLRequest({
    endpoint: agencyUrl,
    query: updateMutation,
    variables: { id: contactActivity.id, attributes: updateData },
  }, 1);

  const { contactActivity: updated, error: updateError } = updateResult.contactActivityUpdate;
  assertEqual('update error should be null', updateError, null);
  assertDefined('updated contactActivity should exist', updated);

  console.log('  Verifying updated contact activity...');
  assertEqual('updated startDate', updated.startDate, updateData.startDate);
  assertEqual('updated endDate', updated.endDate, updateData.endDate);
}
