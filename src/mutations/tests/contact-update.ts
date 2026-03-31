import { Pool } from 'pg';
import { faker } from '@faker-js/faker';
import { executeGraphQLRequest } from '../../graphql';
import {
  getAgencyUrl,
  assertEqual,
  assertDefined,
} from '../helpers';

export const name = 'ContactCreate → ContactUpdate';

export async function run(pool: Pool): Promise<void> {
  const agencyUrl = await getAgencyUrl();

  // ── Step 1: Create a contact ──
  console.log('  Creating contact...');

  const createResult = await executeGraphQLRequest({
    endpoint: agencyUrl,
    query: `
      mutation contactCreate($attributes: ContactAttributes!) {
        contactCreate(attributes: $attributes) {
          contact { id firstName lastName email mobile }
          error
        }
      }
    `,
    variables: {
      attributes: {
        firstName: faker.person.firstName(),
        lastName: faker.person.lastName(),
        email: `contact-update-${Date.now()}@example.com`,
        mobile: faker.phone.number(),
      },
    },
  }, 1);

  const { contact, error: createError } = createResult.contactCreate;
  assertEqual('create error', createError, null);
  assertDefined('contact', contact);
  console.log(`  Contact created: ${contact.id}`);

  // ── Step 2: Update the contact ──
  console.log('  Updating contact...');

  const newFirstName = faker.person.firstName();
  const newLastName = faker.person.lastName();
  const newEmail = `contact-updated-${Date.now()}@example.com`;

  const updateResult = await executeGraphQLRequest({
    endpoint: agencyUrl,
    query: `
      mutation contactUpdate($id: ID!, $attributes: ContactAttributes!) {
        contactUpdate(id: $id, attributes: $attributes) {
          contact { id firstName lastName email jobTitle }
          error
        }
      }
    `,
    variables: {
      id: contact.id,
      attributes: {
        firstName: newFirstName,
        lastName: newLastName,
        email: newEmail,
        jobTitle: 'Test Engineer',
      },
    },
  }, 1);

  const { contact: updated, error: updateError } = updateResult.contactUpdate;
  assertEqual('update error', updateError, null);
  assertDefined('updated contact', updated);
  assertEqual('id', updated.id, contact.id);
  assertEqual('firstName', updated.firstName, newFirstName);
  assertEqual('lastName', updated.lastName, newLastName);
  assertEqual('email', updated.email, newEmail);
  assertEqual('jobTitle', updated.jobTitle, 'Test Engineer');
  console.log(`  Contact updated: ${updated.id}, name=${updated.firstName} ${updated.lastName}`);
}
