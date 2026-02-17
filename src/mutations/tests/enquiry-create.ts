import { Pool } from 'pg';
import { faker } from '@faker-js/faker';
import { executeGraphQLRequest } from '../../graphql';
import {
  getAgencyUrl,
  fetchActiveSalesListing,
  fetchActiveConsultant,
  assertEqual,
  assertDefined,
} from '../helpers';

export const name = 'EnquiryCreate';

export async function run(pool: Pool): Promise<void> {
  const agencyUrl = await getAgencyUrl();

  // Step 1: Find an active sales listing from local DB
  console.log('  Querying local DB for active sales listing...');
  const listing = await fetchActiveSalesListing(pool);
  console.log(`  Found listing ID: ${listing.id} (status: ${listing.status})`);

  // Step 2: Find an active consultant from local DB
  console.log('  Querying local DB for active consultant...');
  const consultant = await fetchActiveConsultant(pool);
  console.log(`  Found consultant ID: ${consultant.id} (${consultant.fullName})`);

  // Step 3: Generate fake enquiry data
  const enquiryData = {
    from: faker.internet.email(),
    messageId: faker.string.uuid(),
    subject: faker.lorem.sentence(),
    message: faker.lorem.paragraph(),
    salesListingId: Number(listing.id),
    consultantId: Number(consultant.id),
    contactName: faker.person.fullName(),
    contactEmail: faker.internet.email(),
    contactPhone: faker.phone.number(),
  };

  console.log('  Creating enquiry via GraphQL...');
  console.log(`    from: ${enquiryData.from}`);
  console.log(`    contactName: ${enquiryData.contactName}`);
  console.log(`    salesListingId: ${enquiryData.salesListingId}`);
  console.log(`    consultantId: ${enquiryData.consultantId}`);

  // Step 4: Execute EnquiryCreate mutation
  const mutation = `
    mutation enquiryCreate($attributes: EnquiryAttributes!) {
      enquiryCreate(attributes: $attributes) {
        enquiry {
          id
          salesListingId
          contactName
          contactEmail
          contactPhone
          message
          messageId
          from
          subject
          consultantId
        }
        error
      }
    }
  `;

  const result = await executeGraphQLRequest({
    endpoint: agencyUrl,
    query: mutation,
    variables: { attributes: enquiryData },
  }, 1);

  const { enquiry, error } = result.enquiryCreate;

  // Step 5: Assert no error
  assertEqual('error should be null', error, null);
  assertDefined('enquiry should exist', enquiry);
  assertDefined('enquiry.id should exist', enquiry.id);

  console.log(`  Enquiry created with id: ${enquiry.id}`);

  // Step 6: Verify returned data matches submitted data
  console.log('  Verifying enquiry data...');
  assertEqual('messageId', enquiry.messageId, enquiryData.messageId);
  assertEqual('from', enquiry.from, enquiryData.from);
  assertEqual('subject', enquiry.subject, enquiryData.subject);
  assertEqual('message', enquiry.message, enquiryData.message);
  assertEqual('contactName', enquiry.contactName, enquiryData.contactName);
  assertEqual('contactEmail', enquiry.contactEmail, enquiryData.contactEmail);
  assertEqual('salesListingId', String(enquiry.salesListingId), String(enquiryData.salesListingId));
  assertEqual('consultantId', String(enquiry.consultantId), String(enquiryData.consultantId));

}
