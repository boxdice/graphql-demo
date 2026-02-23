import { Pool } from 'pg';
import { faker } from '@faker-js/faker';
import { executeGraphQLRequest } from '../../graphql';
import {
  getAgencyUrl,
  assertEqual,
  assertDefined,
} from '../helpers';

export const name = 'BuyingCriteriaCreate';

export async function run(pool: Pool): Promise<void> {
  const agencyUrl = await getAgencyUrl();

  // ── Create a contact to attach buying criteria to ──
  console.log('  Creating contact...');

  const contactCreateMutation = `
    mutation contactCreate($attributes: ContactAttributes!) {
      contactCreate(attributes: $attributes) {
        contact { id firstName lastName }
        error
      }
    }
  `;

  const contactResult = await executeGraphQLRequest({
    endpoint: agencyUrl,
    query: contactCreateMutation,
    variables: {
      attributes: {
        firstName: faker.person.firstName(),
        lastName: faker.person.lastName(),
        email: faker.internet.email(),
      },
    },
  }, 1);

  const { contact, error: contactError } = contactResult.contactCreate;
  assertEqual('contact create error', contactError, null);
  assertDefined('contact should exist', contact);
  console.log(`    Contact created: ${contact.id} (${contact.firstName} ${contact.lastName})`);

  // ── Create buying criteria ──
  console.log('  Creating buying criteria...');

  const bedsFrom = faker.number.int({ min: 1, max: 3 });
  const bedsTo = faker.number.int({ min: bedsFrom, max: 5 });
  const priceFrom = faker.number.int({ min: 300000, max: 500000 });
  const priceTo = faker.number.int({ min: priceFrom, max: 900000 });

  const createMutation = `
    mutation buyingCriteriaCreate($attributes: BuyingCriteriaAttributes!) {
      buyingCriteriaCreate(attributes: $attributes) {
        buyingCriteriaId
        buyingCriteria {
          id
          contactId
          itemType
          bedsFrom
          bedsTo
          baths
          cars
          priceFrom
          priceTo
          notes
        }
        error
      }
    }
  `;

  const createData = {
    contactId: Number(contact.id),
    bedsFrom,
    bedsTo,
    baths: faker.number.int({ min: 1, max: 3 }),
    cars: faker.number.int({ min: 1, max: 3 }),
    priceFrom,
    priceTo,
    notes: `E2E test buying criteria ${faker.lorem.sentence()}`,
  };

  const result = await executeGraphQLRequest({
    endpoint: agencyUrl,
    query: createMutation,
    variables: { attributes: createData },
  }, 1);

  const { buyingCriteriaId, buyingCriteria, error } = result.buyingCriteriaCreate;
  assertEqual('create error should be null', error, null);
  assertDefined('buyingCriteriaId should exist', buyingCriteriaId);
  assertDefined('buyingCriteria should exist', buyingCriteria);
  assertEqual('bedsFrom', buyingCriteria.bedsFrom, createData.bedsFrom);
  assertEqual('bedsTo', buyingCriteria.bedsTo, createData.bedsTo);
  assertEqual('baths', buyingCriteria.baths, createData.baths);
  assertEqual('cars', buyingCriteria.cars, createData.cars);
  assertEqual('priceFrom', buyingCriteria.priceFrom, createData.priceFrom);
  assertEqual('priceTo', buyingCriteria.priceTo, createData.priceTo);

  console.log(`    Buying criteria created: ${buyingCriteriaId}`);
  console.log(`      beds: ${createData.bedsFrom}-${createData.bedsTo}, price: ${createData.priceFrom}-${createData.priceTo}`);
}
