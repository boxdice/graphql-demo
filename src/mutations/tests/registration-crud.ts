import { Pool } from 'pg';
import { faker } from '@faker-js/faker';
import { executeGraphQLRequest } from '../../graphql';
import {
  getAgencyUrl,
  fetchActiveSalesListing,
  fetchActiveConsultant,
  fetchSource,
  assertEqual,
  assertDefined,
} from '../helpers';

export const name = 'RegistrationCreate → RegistrationUpdate → RegistrationDelete';

export async function run(pool: Pool): Promise<void> {
  const agencyUrl = await getAgencyUrl();

  const salesListing = await fetchActiveSalesListing(pool);
  const consultant = await fetchActiveConsultant(pool);
  const source = await fetchSource(pool);

  // ── Step 1: Create a contact ──
  // A fresh contact guarantees registrationCreate creates a new registration
  // instead of returning an existing one (create is idempotent per contact+listing).
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

  // ── Step 2: Create Registration ──
  console.log('  Creating registration...');

  const priceInterested = faker.number.int({ min: 300000, max: 900000 });
  const createData = {
    contactId: contact.id,
    salesListingId: salesListing.id,
    interestLevel: 'IN',
    sourceId: source.id,
    // Without an explicit consultant, an API key with no bound consultant
    // attributes the registration to bd_admin (office 1) and it disappears
    // from the agency's view.
    consultantId: consultant.id,
    priceInterested,
    startDate: new Date().toISOString().slice(0, 10),
  };

  const createResult = await executeGraphQLRequest({
    endpoint: agencyUrl,
    query: `
      mutation registrationCreate($attributes: RegistrationCreateAttributes!) {
        registrationCreate(attributes: $attributes) {
          registration {
            id
            contactId
            contactActivityId
            salesListingId
            interestLevel
            priceInterested
            sourceId
          }
          error
        }
      }
    `,
    variables: { attributes: createData },
  }, 1);

  const { registration, error: createError } = createResult.registrationCreate;
  assertEqual('create error', createError, null);
  assertDefined('registration', registration);
  assertDefined('registration.contactActivityId', registration.contactActivityId);
  assertEqual('contactId', String(registration.contactId), String(contact.id));
  assertEqual('salesListingId', String(registration.salesListingId), String(salesListing.id));
  assertEqual('interestLevel', registration.interestLevel, 'IN');
  assertEqual('priceInterested', registration.priceInterested, priceInterested);
  assertEqual('sourceId', String(registration.sourceId), String(source.id));
  console.log(`  Registration created: ${registration.id}`);

  // ── Step 3: Update Registration ──
  console.log('  Updating registration...');

  const newPriceInterested = faker.number.int({ min: priceInterested, max: 1200000 });
  const updateData = {
    interestLevel: 'MAYBE',
    priceInterested: newPriceInterested,
  };

  const updateResult = await executeGraphQLRequest({
    endpoint: agencyUrl,
    query: `
      mutation registrationUpdate($id: ID!, $attributes: RegistrationUpdateAttributes!) {
        registrationUpdate(id: $id, attributes: $attributes) {
          registration {
            id
            interestLevel
            priceInterested
          }
          error
        }
      }
    `,
    variables: { id: registration.id, attributes: updateData },
  }, 1);

  const { registration: updated, error: updateError } = updateResult.registrationUpdate;
  assertEqual('update error', updateError, null);
  assertDefined('updated registration', updated);
  assertEqual('updated id', String(updated.id), String(registration.id));
  assertEqual('updated interestLevel', updated.interestLevel, 'MAYBE');
  assertEqual('updated priceInterested', updated.priceInterested, newPriceInterested);
  console.log(`  Registration updated: interestLevel=MAYBE, priceInterested=${newPriceInterested}`);

  // ── Step 4: Delete Registration ──
  console.log('  Deleting registration...');

  const deleteResult = await executeGraphQLRequest({
    endpoint: agencyUrl,
    query: `
      mutation registrationDelete($id: ID!) {
        registrationDelete(id: $id) {
          success
          error
        }
      }
    `,
    variables: { id: registration.id },
  }, 1);

  const { success, error: deleteError } = deleteResult.registrationDelete;
  assertEqual('delete error', deleteError, null);
  assertEqual('delete success', success, true);
  console.log(`  Registration deleted: ${registration.id}`);
}
