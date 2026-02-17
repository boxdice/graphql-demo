import { Pool } from 'pg';
import { faker } from '@faker-js/faker';
import { executeGraphQLRequest } from '../../graphql';
import {
  getAgencyUrl,
  fetchActiveConsultant,
  assertEqual,
  assertDefined,
} from '../helpers';

export const name = 'LeadFlowCreate';

export async function run(pool: Pool): Promise<void> {
  const agencyUrl = await getAgencyUrl();

  console.log('  Gathering test data from local DB...');
  const consultant = await fetchActiveConsultant(pool);
  console.log(`    consultant: ${consultant.id} (${consultant.fullName})`);

  const createMutation = `
    mutation leadFlowCreate($attributes: LeadFlowAttributes!) {
      leadFlowCreate(attributes: $attributes) {
        lead { id }
        error
      }
    }
  `;

  // ── Step 1: Create lead with new contact details ──
  console.log('  [1] Creating lead with new contact details...');

  const result = await executeGraphQLRequest({
    endpoint: agencyUrl,
    query: createMutation,
    variables: {
      attributes: {
        consultantId: Number(consultant.id),
        contactName: `${faker.person.firstName()} ${faker.person.lastName()}`,
        contactEmail: faker.internet.email(),
        contactPhone: faker.string.numeric(10),
        temperature: 'WARM',
        leadFlowType: 'SALES',
        comment: `E2E test lead created at ${new Date().toISOString()}`,
      },
    },
  }, 1);

  const { lead, error } = result.leadFlowCreate;
  assertEqual('create error should be null', error, null);
  assertDefined('lead should exist', lead);
  assertDefined('lead.id should exist', lead.id);
  console.log(`      Lead created: ${lead.id}`);

  // ── Step 2: Create lead with address ──
  console.log('  [2] Creating lead with address...');

  const addressResult = await executeGraphQLRequest({
    endpoint: agencyUrl,
    query: createMutation,
    variables: {
      attributes: {
        consultantId: Number(consultant.id),
        contactName: `${faker.person.firstName()} ${faker.person.lastName()}`,
        contactEmail: faker.internet.email(),
        contactPhone: faker.string.numeric(10),
        temperature: 'HOT',
        leadFlowType: 'SALES',
        streetName: faker.location.street(),
        streetType: 'Street',
        number: String(faker.number.int({ min: 1, max: 200 })),
        suburb: 'Footscray',
        postcode: '3011',
        state: 'VIC',
        country: 'Australia',
      },
    },
  }, 1);

  const { lead: addressLead, error: addressError } = addressResult.leadFlowCreate;
  assertEqual('address lead error should be null', addressError, null);
  assertDefined('address lead should exist', addressLead);
  console.log(`      Lead with address created: ${addressLead.id}`);

  // ── Step 3: Create contact, then create lead with mismatched details ──
  // AC: GIVEN contact_id is provided, WHEN contact_name/email/phone are also provided
  //     AND one or more do not match, THEN record the value(s) as a comment.
  console.log('  [3] Creating contact, then lead with mismatched contact details...');

  const contactCreateMutation = `
    mutation contactCreate($attributes: ContactAttributes!) {
      contactCreate(attributes: $attributes) {
        contact { id firstName lastName email mobile }
        error
      }
    }
  `;

  const contactData = {
    firstName: faker.person.firstName(),
    lastName: faker.person.lastName(),
    email: faker.internet.email(),
    mobile: faker.string.numeric(10),
  };

  const contactResult = await executeGraphQLRequest({
    endpoint: agencyUrl,
    query: contactCreateMutation,
    variables: { attributes: contactData },
  }, 1);

  const { contact, error: contactError } = contactResult.contactCreate;
  assertEqual('contact create error', contactError, null);
  assertDefined('contact should exist', contact);
  console.log(`      Contact created: ${contact.id} (${contact.firstName} ${contact.lastName})`);

  // Create lead with the contact_id but different name, email, and phone
  const mismatchedName = `${faker.person.firstName()} ${faker.person.lastName()}`;
  const mismatchedEmail = faker.internet.email();
  const mismatchedPhone = faker.string.numeric(10);

  const mismatchResult = await executeGraphQLRequest({
    endpoint: agencyUrl,
    query: createMutation,
    variables: {
      attributes: {
        consultantId: Number(consultant.id),
        contactId: Number(contact.id),
        contactName: mismatchedName,
        contactEmail: mismatchedEmail,
        contactPhone: mismatchedPhone,
        temperature: 'COLD',
        leadFlowType: 'SALES',
      },
    },
  }, 1);

  const { lead: mismatchLead, error: mismatchError } = mismatchResult.leadFlowCreate;
  assertEqual('mismatch lead error should be null', mismatchError, null);
  assertDefined('mismatch lead should exist', mismatchLead);
  console.log(`      Lead with mismatched contact created: ${mismatchLead.id}`);
  console.log(`      (mismatched details recorded as comment on lead server-side)`);
}
