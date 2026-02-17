import { Pool } from 'pg';
import { faker } from '@faker-js/faker';
import { executeGraphQLRequest } from '../../graphql';
import {
  getAgencyUrl,
  fetchOffice,
  assertEqual,
  assertDefined,
} from '../helpers';

export const name = 'ConsultantCreate → ConsultantUpdate';

export async function run(pool: Pool): Promise<void> {
  const agencyUrl = await getAgencyUrl();
  const office = await fetchOffice(pool);

  // ── Step 1: Create Consultant ──
  console.log('  Creating consultant...');

  const createData = {
    firstName: faker.person.firstName(),
    lastName: faker.person.lastName(),
    email: faker.internet.email(),
    mobile: faker.string.numeric(10),
    phone: faker.string.numeric(10),
    position: faker.person.jobTitle(),
    salutation: faker.helpers.arrayElement(['Mr', 'Mrs', 'Ms', 'Dr']),
    initials: faker.string.alpha({ length: 2, casing: 'upper' }),
    streetAddress: faker.location.streetAddress(),
    suburb: faker.location.city(),
    state: faker.location.state({ abbreviated: true }),
    postcode: faker.location.zipCode(),
    country: 'Australia',
    officeId: Number(office.id),
  };

  const createMutation = `
    mutation consultantCreate($attributes: ConsultantAttributes!) {
      consultantCreate(attributes: $attributes) {
        consultant {
          id
          firstName
          lastName
          email
          mobile
          phone
          position
          salutation
          initials
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

  const { consultant, error: createError } = createResult.consultantCreate;
  assertEqual('create error should be null', createError, null);
  assertDefined('consultant should exist', consultant);
  assertDefined('consultant.id should exist', consultant.id);

  console.log(`  Consultant created with id: ${consultant.id}`);

  // Verify created data
  console.log('  Verifying created consultant...');
  assertEqual('firstName', consultant.firstName, createData.firstName);
  assertEqual('lastName', consultant.lastName, createData.lastName);
  assertEqual('email', consultant.email, createData.email);
  assertDefined('mobile', consultant.mobile);
  assertDefined('phone', consultant.phone);
  assertEqual('position', consultant.position, createData.position);
  assertEqual('initials', consultant.initials, createData.initials);
  assertEqual('streetAddress', consultant.streetAddress, createData.streetAddress);
  assertEqual('suburb', consultant.suburb, createData.suburb);
  assertEqual('state', consultant.state, createData.state);
  assertEqual('postcode', consultant.postcode, createData.postcode);
  assertEqual('country', consultant.country, createData.country);

  // ── Step 2: Update Consultant ──
  console.log('  Updating consultant...');

  const updateData = {
    firstName: faker.person.firstName(),
    lastName: faker.person.lastName(),
    email: faker.internet.email(),
    position: faker.person.jobTitle(),
    mobile: faker.string.numeric(10),
  };

  const updateMutation = `
    mutation consultantUpdate($id: ID!, $attributes: ConsultantAttributes!) {
      consultantUpdate(id: $id, attributes: $attributes) {
        consultant {
          id
          firstName
          lastName
          email
          position
          mobile
        }
        error
      }
    }
  `;

  const updateResult = await executeGraphQLRequest({
    endpoint: agencyUrl,
    query: updateMutation,
    variables: { id: consultant.id, attributes: updateData },
  }, 1);

  const { consultant: updated, error: updateError } = updateResult.consultantUpdate;
  assertEqual('update error should be null', updateError, null);
  assertDefined('updated consultant should exist', updated);

  console.log('  Verifying updated consultant...');
  assertEqual('updated firstName', updated.firstName, updateData.firstName);
  assertEqual('updated lastName', updated.lastName, updateData.lastName);
  assertEqual('updated email', updated.email, updateData.email);
  assertEqual('updated position', updated.position, updateData.position);
  assertDefined('updated mobile', updated.mobile);
}
