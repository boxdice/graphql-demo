import { Pool } from 'pg';
import { faker } from '@faker-js/faker';
import { executeGraphQLRequest } from '../../graphql';
import {
  getAgencyUrl,
  assertEqual,
  assertDefined,
  fetchActiveConsultant,
  fetchContacts,
} from '../helpers';

export const name = 'PropertySoldOutsideCreate';

export async function run(pool: Pool): Promise<void> {
  const agencyUrl = await getAgencyUrl();

  const consultant = await fetchActiveConsultant(pool);
  console.log(`  Consultant: ${consultant.id} (${consultant.fullName})`);

  const contacts = await fetchContacts(pool, 2);
  console.log(`  Contacts: ${contacts.map(c => c.id).join(', ')}`);

  // ── Fetch a property ──
  console.log('  Fetching property...');

  const propertiesQuery = `
    query {
      properties(limit: 1) {
        items { id streetName suburb }
      }
    }
  `;

  const propertiesResult = await executeGraphQLRequest({
    endpoint: agencyUrl,
    query: propertiesQuery,
  }, 1);

  const property = propertiesResult.properties.items[0];
  assertDefined('property should exist', property);
  console.log(`    Property: ${property.id} (${property.streetName}, ${property.suburb})`);

  // ── Step 1: Create with minimal attributes ──
  const agencyName = `${faker.company.name()} Real Estate`;
  console.log(`  Step 1: Creating with minimal attributes (agency: ${agencyName})...`);

  const createMutation = `
    mutation propertySoldOutsideCreate($attributes: PropertySoldOutsideAttributes!) {
      propertySoldOutsideCreate(attributes: $attributes) {
        propertySoldOutsideId
        error
      }
    }
  `;

  const result1 = await executeGraphQLRequest({
    endpoint: agencyUrl,
    query: createMutation,
    variables: {
      attributes: {
        agencyName,
        propertyId: Number(property.id),
        consultantId: Number(consultant.id),
      },
    },
  }, 1);

  const { propertySoldOutsideId: id1, error: error1 } = result1.propertySoldOutsideCreate;
  assertEqual('step 1 error should be null', error1, null);
  assertDefined('step 1 propertySoldOutsideId should exist', id1);
  console.log(`    Created: ${id1}`);

  // ── Step 2: Create with all attributes including owners ──
  const soldPrice = faker.number.int({ min: 500000, max: 2000000 });
  const settleDate = '2026-03-15';
  const agencyName2 = `${faker.company.name()} Realty`;
  console.log(`  Step 2: Creating with owners, sold price, settle date (agency: ${agencyName2})...`);

  const result2 = await executeGraphQLRequest({
    endpoint: agencyUrl,
    query: createMutation,
    variables: {
      attributes: {
        agencyName: agencyName2,
        propertyId: Number(property.id),
        consultantId: Number(consultant.id),
        soldPrice,
        settleDate,
        currentContactIds: [contacts[0].id],
        newContactIds: [contacts[1].id],
        notes: 'Sold outside listing - created via mutation test',
      },
    },
  }, 1);

  const { propertySoldOutsideId: id2, error: error2 } = result2.propertySoldOutsideCreate;
  assertEqual('step 2 error should be null', error2, null);
  assertDefined('step 2 propertySoldOutsideId should exist', id2);
  console.log(`    Created: ${id2} (sold price: ${soldPrice}, settle: ${settleDate})`);
}
