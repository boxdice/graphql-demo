import { Pool } from 'pg';
import { faker } from '@faker-js/faker';
import { executeGraphQLRequest } from '../../graphql';
import {
  getAgencyUrl,
  assertEqual,
  assertDefined,
} from '../helpers';

export const name = 'OfficeCreate → OfficeUpdate';

export async function run(pool: Pool): Promise<void> {
  const agencyUrl = await getAgencyUrl();

  // ── Step 1: Create Office ──
  console.log('  Creating office...');

  const createData = {
    name: faker.company.name(),
    email: faker.internet.email(),
    phone: faker.phone.number(),
    fax: faker.phone.number(),
    streetAddress: faker.location.streetAddress(),
    suburb: faker.location.city(),
    state: faker.location.state({ abbreviated: true }),
    postcode: faker.location.zipCode(),
    country: 'Australia',
  };

  const createMutation = `
    mutation officeCreate($attributes: OfficeAttributes!) {
      officeCreate(attributes: $attributes) {
        office {
          id
          name
          email
          phone
          fax
          streetAddress
          suburb
          state
          postcode
          country
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

  const { office, error: createError } = createResult.officeCreate;
  assertEqual('create error should be null', createError, null);
  assertDefined('office should exist', office);
  assertDefined('office.id should exist', office.id);

  console.log(`  Office created with id: ${office.id}`);

  // Verify created data
  console.log('  Verifying created office...');
  assertEqual('name', office.name, createData.name);
  assertEqual('email', office.email, createData.email);
  assertEqual('phone', office.phone, createData.phone);
  assertEqual('fax', office.fax, createData.fax);
  assertEqual('streetAddress', office.streetAddress, createData.streetAddress);
  assertEqual('suburb', office.suburb, createData.suburb);
  assertEqual('state', office.state, createData.state);
  assertEqual('postcode', office.postcode, createData.postcode);
  assertEqual('country', office.country, createData.country);

  // ── Step 2: Update Office ──
  console.log('  Updating office...');

  const updateData = {
    name: faker.company.name(),
    email: faker.internet.email(),
    phone: faker.phone.number(),
  };

  const updateMutation = `
    mutation officeUpdate($id: ID!, $attributes: OfficeAttributes!) {
      officeUpdate(id: $id, attributes: $attributes) {
        office {
          id
          name
          email
          phone
        }
        error
      }
    }
  `;

  const updateResult = await executeGraphQLRequest({
    endpoint: agencyUrl,
    query: updateMutation,
    variables: { id: office.id, attributes: updateData },
  }, 1);

  const { office: updated, error: updateError } = updateResult.officeUpdate;
  assertEqual('update error should be null', updateError, null);
  assertDefined('updated office should exist', updated);

  console.log('  Verifying updated office...');
  assertEqual('updated name', updated.name, updateData.name);
  assertEqual('updated email', updated.email, updateData.email);
  assertEqual('updated phone', updated.phone, updateData.phone);
}
