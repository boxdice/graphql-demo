import { Pool } from 'pg';
import { faker } from '@faker-js/faker';
import { executeGraphQLRequest } from '../../graphql';
import {
  getAgencyUrl,
  assertEqual,
  assertDefined,
} from '../helpers';

export const name = 'BuyingCriteriaCreate → BuyingCriteriaUpdate → BuyingCriteriaDelete';

export async function run(pool: Pool): Promise<void> {
  const agencyUrl = await getAgencyUrl();

  // ── Step 1: Create a contact ──
  console.log('  Creating contact...');

  const contactResult = await executeGraphQLRequest({
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
        email: faker.internet.email(),
      },
    },
  }, 1);

  const { contact, error: contactError } = contactResult.contactCreate;
  assertEqual('contact create error', contactError, null);
  assertDefined('contact', contact);
  console.log(`  Contact created: ${contact.id}`);

  // ── Step 2: Create BuyingCriteria ──
  console.log('  Creating buying criteria...');

  const bedsFrom = faker.number.int({ min: 1, max: 3 });
  const bedsTo = faker.number.int({ min: bedsFrom, max: 5 });
  const priceFrom = faker.number.int({ min: 300000, max: 500000 });
  const priceTo = faker.number.int({ min: priceFrom, max: 900000 });
  const createData = {
    contactId: Number(contact.id),
    bedsFrom,
    bedsTo,
    baths: faker.number.int({ min: 1, max: 3 }),
    cars: faker.number.int({ min: 1, max: 5 }),
    priceFrom,
    priceTo,
    notes: faker.lorem.sentence(),
  };

  const createResult = await executeGraphQLRequest({
    endpoint: agencyUrl,
    query: `
      mutation buyingCriteriaCreate($attributes: BuyingCriteriaAttributes!) {
        buyingCriteriaCreate(attributes: $attributes) {
          buyingCriteriaId
          buyingCriteria { id bedsFrom bedsTo baths cars priceFrom priceTo notes }
          error
        }
      }
    `,
    variables: { attributes: createData },
  }, 1);

  const { buyingCriteriaId, buyingCriteria, error: createError } = createResult.buyingCriteriaCreate;
  assertEqual('create error', createError, null);
  assertDefined('buyingCriteriaId', buyingCriteriaId);
  assertDefined('buyingCriteria', buyingCriteria);
  assertEqual('bedsFrom', buyingCriteria.bedsFrom, createData.bedsFrom);
  assertEqual('bedsTo', buyingCriteria.bedsTo, createData.bedsTo);
  assertEqual('priceFrom', buyingCriteria.priceFrom, createData.priceFrom);
  assertEqual('priceTo', buyingCriteria.priceTo, createData.priceTo);
  console.log(`  Buying criteria created: ${buyingCriteriaId}`);

  // ── Step 3: Update BuyingCriteria ──
  console.log('  Updating buying criteria...');

  const newPriceFrom = faker.number.int({ min: 400000, max: 600000 });
  const newPriceTo = faker.number.int({ min: newPriceFrom, max: 1000000 });
  const updateData = {
    id: buyingCriteriaId,
    priceFrom: newPriceFrom,
    priceTo: newPriceTo,
    notes: faker.lorem.sentence(),
  };

  const updateResult = await executeGraphQLRequest({
    endpoint: agencyUrl,
    query: `
      mutation buyingCriteriaUpdate($attributes: BuyingCriteriaUpdateAttributes!) {
        buyingCriteriaUpdate(attributes: $attributes) {
          buyingCriteria { id priceFrom priceTo notes }
          error
        }
      }
    `,
    variables: { attributes: updateData },
  }, 1);

  const { buyingCriteria: updated, error: updateError } = updateResult.buyingCriteriaUpdate;
  assertEqual('update error', updateError, null);
  assertDefined('updated buyingCriteria', updated);
  assertEqual('updated priceFrom', updated.priceFrom, newPriceFrom);
  assertEqual('updated priceTo', updated.priceTo, newPriceTo);
  assertEqual('updated notes', updated.notes, updateData.notes);
  console.log(`  Buying criteria updated: priceFrom=${newPriceFrom}, priceTo=${newPriceTo}`);

  // ── Step 4: Delete BuyingCriteria ──
  console.log('  Deleting buying criteria...');

  const deleteResult = await executeGraphQLRequest({
    endpoint: agencyUrl,
    query: `
      mutation buyingCriteriaDelete($id: ID!) {
        buyingCriteriaDelete(id: $id) {
          success
          error
        }
      }
    `,
    variables: { id: buyingCriteriaId },
  }, 1);

  const { success, error: deleteError } = deleteResult.buyingCriteriaDelete;
  assertEqual('delete error', deleteError, null);
  assertEqual('delete success', success, true);
  console.log(`  Buying criteria deleted: ${buyingCriteriaId}`);
}
