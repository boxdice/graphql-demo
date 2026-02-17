import { Pool } from 'pg';
import { faker } from '@faker-js/faker';
import { executeGraphQLRequest } from '../../graphql';
import {
  getAgencyUrl,
  assertEqual,
  assertEqualIgnoreCase,
  assertDefined,
} from '../helpers';

export const name = 'PropertyCrud';

export async function run(pool: Pool): Promise<void> {
  const agencyUrl = await getAgencyUrl();

  // ── Create Property ──
  const streetName = faker.location.street();
  const beds = faker.number.int({ min: 1, max: 5 });
  const baths = faker.number.int({ min: 1, max: 3 });

  const createData = {
    streetName,
    streetType: 'Street',
    suburb: 'Sydney',
    state: 'NSW',
    postcode: '2000',
    country: 'Australia',
    number: String(faker.number.int({ min: 1, max: 200 })),
    beds,
    baths,
    carspaces: faker.number.int({ min: 0, max: 3 }),
  };

  console.log(`  Creating property at ${createData.number} ${streetName} Street, Sydney...`);

  const createMutation = `
    mutation propertyCreate($attributes: PropertyAttributes!) {
      propertyCreate(attributes: $attributes) {
        property {
          id
          streetName
          streetType
          suburb
          state
          postcode
          country
          number
          beds
          baths
          carspaces
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

  const { property: created, error: createError } = createResult.propertyCreate;
  assertEqual('create error should be null', createError, null);
  assertDefined('property should exist', created);
  assertDefined('property.id should exist', created.id);
  assertEqual('streetName', created.streetName, createData.streetName);
  assertEqualIgnoreCase('suburb', created.suburb, 'SYDNEY');
  assertEqual('state', created.state, createData.state);
  assertEqual('postcode', created.postcode, createData.postcode);
  assertEqual('beds', created.beds, createData.beds);
  assertEqual('baths', created.baths, createData.baths);

  const propertyId = created.id;
  console.log(`  Property created with id: ${propertyId}`);

  // ── Update Property ──
  const newBeds = faker.number.int({ min: 1, max: 6 });
  const newBaths = faker.number.int({ min: 1, max: 4 });
  const newLandSize = faker.number.int({ min: 200, max: 1000 });

  const updateData = {
    beds: newBeds,
    baths: newBaths,
    landSize: newLandSize,
    landMeasure: 'SQM',
  };

  console.log(`  Updating property ${propertyId}...`);

  const updateMutation = `
    mutation propertyUpdate($id: ID!, $attributes: PropertyUpdateAttributes!) {
      propertyUpdate(id: $id, attributes: $attributes) {
        property {
          id
          streetName
          suburb
          beds
          baths
          landSize
          landMeasure
        }
        error
      }
    }
  `;

  const updateResult = await executeGraphQLRequest({
    endpoint: agencyUrl,
    query: updateMutation,
    variables: { id: propertyId, attributes: updateData },
  }, 1);

  const { property: updated, error: updateError } = updateResult.propertyUpdate;
  assertEqual('update error should be null', updateError, null);
  assertDefined('updated property should exist', updated);
  assertEqual('updated id', updated.id, propertyId);
  assertEqual('updated beds', updated.beds, newBeds);
  assertEqual('updated baths', updated.baths, newBaths);
  assertEqual('updated landSize', updated.landSize, newLandSize);
  assertEqual('updated landMeasure', updated.landMeasure, 'Sqm'); // enum SQM maps to "Sqm" in pro
  // Original fields should be preserved
  assertEqual('streetName preserved', updated.streetName, createData.streetName);
  assertEqualIgnoreCase('suburb preserved', updated.suburb, 'SYDNEY');

  console.log(`  Property ${propertyId} updated successfully`);

  // ── Create Duplicate Property (same data) ──
  console.log(`  Creating duplicate property with same address...`);

  const dupeResult = await executeGraphQLRequest({
    endpoint: agencyUrl,
    query: createMutation,
    variables: { attributes: createData },
  }, 1);

  const { property: dupeProperty, error: dupeError } = dupeResult.propertyCreate;
  assertDefined('duplicate should return an error', dupeError);
  assertEqual('duplicate property should be null', dupeProperty, null);
  console.log(`  Duplicate correctly rejected: ${dupeError}`);
}
