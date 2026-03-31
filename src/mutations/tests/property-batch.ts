import { Pool } from 'pg';
import { faker } from '@faker-js/faker';
import { executeGraphQLRequest } from '../../graphql';
import {
  getAgencyUrl,
  assertEqual,
  assertDefined,
} from '../helpers';

export const name = 'PropertyBatchCreate → PropertyBatchUpdate';

function makePropertyAttributes() {
  return {
    streetName: faker.location.street(),
    streetType: 'Street',
    suburb: 'Sydney',
    state: 'NSW',
    postcode: '2000',
    country: 'Australia',
    number: String(faker.number.int({ min: 1, max: 999 })),
    beds: faker.number.int({ min: 1, max: 5 }),
    baths: faker.number.int({ min: 1, max: 3 }),
    carspaces: faker.number.int({ min: 0, max: 3 }),
  };
}

export async function run(pool: Pool): Promise<void> {
  const agencyUrl = await getAgencyUrl();

  // ── Step 1: PropertyBatchCreate ──
  console.log('  Creating properties in batch...');

  const properties = [makePropertyAttributes(), makePropertyAttributes()];

  const createResult = await executeGraphQLRequest({
    endpoint: agencyUrl,
    query: `
      mutation propertyBatchCreate($properties: [PropertyAttributes!]!) {
        propertyBatchCreate(properties: $properties) {
          batch { id status }
          error
        }
      }
    `,
    variables: { properties },
  }, 1);

  const { batch: createBatch, error: createError } = createResult.propertyBatchCreate;
  assertEqual('propertyBatchCreate error', createError, null);
  assertDefined('batch', createBatch);
  assertDefined('batch.id', createBatch.id);
  console.log(`  Property batch created: id=${createBatch.id}, status=${createBatch.status}`);

  // ── Step 2: PropertyBatchUpdate ──
  console.log('  Updating properties in batch...');

  // Create two properties individually first so we have known IDs to update
  const prop1 = makePropertyAttributes();
  const prop2 = makePropertyAttributes();

  const create1 = await executeGraphQLRequest({
    endpoint: agencyUrl,
    query: `
      mutation propertyCreate($attributes: PropertyAttributes!) {
        propertyCreate(attributes: $attributes) {
          property { id }
          error
        }
      }
    `,
    variables: { attributes: prop1 },
  }, 1);
  assertEqual('prop1 create error', create1.propertyCreate.error, null);
  const id1 = create1.propertyCreate.property.id;

  const create2 = await executeGraphQLRequest({
    endpoint: agencyUrl,
    query: `
      mutation propertyCreate($attributes: PropertyAttributes!) {
        propertyCreate(attributes: $attributes) {
          property { id }
          error
        }
      }
    `,
    variables: { attributes: prop2 },
  }, 1);
  assertEqual('prop2 create error', create2.propertyCreate.error, null);
  const id2 = create2.propertyCreate.property.id;

  console.log(`  Created properties for batch update: ${id1}, ${id2}`);

  const updatePayload = [
    { id: id1, attributes: { beds: 4, baths: 2 } },
    { id: id2, attributes: { beds: 3, baths: 1 } },
  ];

  const updateResult = await executeGraphQLRequest({
    endpoint: agencyUrl,
    query: `
      mutation propertyBatchUpdate($properties: [PropertyBatchUpdateItem!]!) {
        propertyBatchUpdate(properties: $properties) {
          batch { id status }
          error
        }
      }
    `,
    variables: { properties: updatePayload },
  }, 1);

  const { batch: updateBatch, error: updateError } = updateResult.propertyBatchUpdate;
  assertEqual('propertyBatchUpdate error', updateError, null);
  assertDefined('update batch', updateBatch);
  assertDefined('update batch.id', updateBatch.id);
  console.log(`  Property batch updated: id=${updateBatch.id}, status=${updateBatch.status}`);
}
