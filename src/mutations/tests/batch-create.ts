import { Pool } from 'pg';
import { faker } from '@faker-js/faker';
import { executeGraphQLRequest } from '../../graphql';
import {
  getAgencyUrl,
  fetchContacts,
  assertEqual,
  assertDefined,
} from '../helpers';

export const name = 'ContactBatchCreate + CommentBatchCreate';

export async function run(pool: Pool): Promise<void> {
  const agencyUrl = await getAgencyUrl();

  // ── Step 1: ContactBatchCreate ──
  console.log('  Creating contacts in batch...');

  const contactsData = [
    {
      firstName: faker.person.firstName(),
      lastName: faker.person.lastName(),
      email: faker.internet.email(),
      mobile: faker.phone.number(),
    },
    {
      firstName: faker.person.firstName(),
      lastName: faker.person.lastName(),
      email: faker.internet.email(),
      mobile: faker.phone.number(),
    },
  ];

  const contactBatchMutation = `
    mutation contactBatchCreate($contacts: [ContactAttributes!]!) {
      contactBatchCreate(contacts: $contacts) {
        batch {
          id
          status
        }
        error
      }
    }
  `;

  const contactBatchResult = await executeGraphQLRequest({
    endpoint: agencyUrl,
    query: contactBatchMutation,
    variables: { contacts: contactsData },
  }, 1);

  const { batch: contactBatch, error: contactBatchError } = contactBatchResult.contactBatchCreate;
  assertEqual('contactBatchCreate error should be null', contactBatchError, null);
  assertDefined('contact batch should exist', contactBatch);
  assertDefined('contact batch.id should exist', contactBatch.id);

  console.log(`  Contact batch created with id: ${contactBatch.id}, status: ${contactBatch.status}`);

  // ── Step 2: CommentBatchCreate ──
  console.log('  Creating comments in batch...');

  const contacts = await fetchContacts(pool, 2);

  const commentsData = [
    {
      content: faker.lorem.paragraph(),
      type: 'GENERAL',
      subtype: faker.lorem.word(),
      contactId: Number(contacts[0].id),
    },
    {
      content: faker.lorem.paragraph(),
      type: 'GENERAL',
      subtype: faker.lorem.word(),
      contactId: Number(contacts[1].id),
    },
  ];

  const commentBatchMutation = `
    mutation commentBatchCreate($comments: [CommentAttributes!]!) {
      commentBatchCreate(comments: $comments) {
        batch {
          id
          status
        }
        error
      }
    }
  `;

  const commentBatchResult = await executeGraphQLRequest({
    endpoint: agencyUrl,
    query: commentBatchMutation,
    variables: { comments: commentsData },
  }, 1);

  const { batch: commentBatch, error: commentBatchError } = commentBatchResult.commentBatchCreate;
  assertEqual('commentBatchCreate error should be null', commentBatchError, null);
  assertDefined('comment batch should exist', commentBatch);
  assertDefined('comment batch.id should exist', commentBatch.id);

  console.log(`  Comment batch created with id: ${commentBatch.id}, status: ${commentBatch.status}`);
}
