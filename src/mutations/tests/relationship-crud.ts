import { Pool } from 'pg';
import { faker } from '@faker-js/faker';
import { executeGraphQLRequest } from '../../graphql';
import {
  getAgencyUrl,
  assertEqual,
  assertDefined,
} from '../helpers';

export const name = 'RelationshipCreate → RelationshipUpdate';

export async function run(pool: Pool): Promise<void> {
  const agencyUrl = await getAgencyUrl();

  // ── Create two contacts to relate ──
  console.log('  Creating two contacts...');

  const createContact = async (label: string) => {
    const result = await executeGraphQLRequest({
      endpoint: agencyUrl,
      query: `
        mutation contactCreate($attributes: ContactAttributes!) {
          contactCreate(attributes: $attributes) {
            contact { id }
            error
          }
        }
      `,
      variables: {
        attributes: {
          firstName: faker.person.firstName(),
          lastName: faker.person.lastName(),
          email: `rel-${label}-${Date.now()}@example.com`,
        },
      },
    }, 1);
    const { contact, error } = result.contactCreate;
    assertEqual(`${label} contact create error`, error, null);
    assertDefined(`${label} contact`, contact);
    return contact;
  };

  const contactA = await createContact('a');
  const contactB = await createContact('b');
  console.log(`  Contacts created: ${contactA.id}, ${contactB.id}`);

  // ── Step 1: Create relationship ──
  console.log('  Creating relationship...');

  const createResult = await executeGraphQLRequest({
    endpoint: agencyUrl,
    query: `
      mutation relationshipCreate($attributes: RelationshipAttributes!) {
        relationshipCreate(attributes: $attributes) {
          relationship { id contactId partnerId relationshipTypeId }
          error
        }
      }
    `,
    variables: {
      attributes: {
        contactId: contactA.id,
        partnerId: contactB.id,
        relationshipTypeId: '1', // "Brother" — known to exist
      },
    },
  }, 1);

  const { relationship, error: createError } = createResult.relationshipCreate;
  assertEqual('create error', createError, null);
  assertDefined('relationship', relationship);
  assertEqual('contactId', relationship.contactId, contactA.id);
  assertEqual('partnerId', relationship.partnerId, contactB.id);
  assertEqual('relationshipTypeId', relationship.relationshipTypeId, '1');
  console.log(`  Relationship created: ${relationship.id}`);

  // ── Step 2: Update relationship type ──
  console.log('  Updating relationship...');

  const updateResult = await executeGraphQLRequest({
    endpoint: agencyUrl,
    query: `
      mutation relationshipUpdate($id: ID!, $relationshipTypeId: ID!) {
        relationshipUpdate(id: $id, relationshipTypeId: $relationshipTypeId) {
          relationship { id relationshipTypeId }
          error
        }
      }
    `,
    variables: {
      id: relationship.id,
      relationshipTypeId: '2', // Change to a different relationship type
    },
  }, 1);

  const { relationship: updated, error: updateError } = updateResult.relationshipUpdate;
  assertEqual('update error', updateError, null);
  assertDefined('updated relationship', updated);
  assertEqual('id', updated.id, relationship.id);
  assertEqual('relationshipTypeId', updated.relationshipTypeId, '2');
  console.log(`  Relationship updated: ${updated.id}, typeId=${updated.relationshipTypeId}`);
}
