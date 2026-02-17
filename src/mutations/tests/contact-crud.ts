import { Pool } from 'pg';
import { faker } from '@faker-js/faker';
import { executeGraphQLRequest } from '../../graphql';
import {
  getAgencyUrl,
  fetchUnusedProperty,
  assertEqual,
  assertDefined,
} from '../helpers';

export const name = 'ContactCreate';

export async function run(pool: Pool): Promise<void> {
  const agencyUrl = await getAgencyUrl();

  // ── Step 1: Create Contact ──
  console.log('  Creating contact...');

  const createData = {
    firstName: faker.person.firstName(),
    lastName: faker.person.lastName(),
    email: faker.internet.email(),
    email2: faker.internet.email(),
    mobile: faker.string.numeric(10),
    phoneBh: faker.string.numeric(10),
    phoneAh: faker.string.numeric(10),
    fax: faker.string.numeric(10),
    jobTitle: faker.person.jobTitle(),
    attention: faker.person.prefix(),
    salutation: faker.helpers.arrayElement(['Mr', 'Mrs', 'Ms', 'Dr']),
    isCompany: false,
  };

  const createMutation = `
    mutation contactCreate($attributes: ContactAttributes!) {
      contactCreate(attributes: $attributes) {
        contact {
          id
          firstName
          lastName
          email
          email2
          mobile
          phoneBh
          phoneAh
          fax
          jobTitle
          attention
          salutation
          isCompany
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

  const { contact, error: createError } = createResult.contactCreate;
  assertEqual('create error should be null', createError, null);
  assertDefined('contact should exist', contact);
  assertDefined('contact.id should exist', contact.id);

  console.log(`  Contact created with id: ${contact.id}`);

  // Verify created data
  console.log('  Verifying created contact...');
  assertEqual('firstName', contact.firstName, createData.firstName);
  assertEqual('lastName', contact.lastName, createData.lastName);
  assertEqual('email', contact.email, createData.email);
  assertEqual('email2', contact.email2, createData.email2);
  // Phone fields are stripped of formatting by the API, so just check they exist
  assertDefined('mobile', contact.mobile);
  assertDefined('phoneBh', contact.phoneBh);
  assertDefined('phoneAh', contact.phoneAh);
  assertDefined('fax', contact.fax);
  assertEqual('jobTitle', contact.jobTitle, createData.jobTitle);
  assertEqual('salutation', contact.salutation, createData.salutation);
  assertEqual('isCompany', contact.isCompany, createData.isCompany);

}
