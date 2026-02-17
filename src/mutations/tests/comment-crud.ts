import { Pool } from 'pg';
import { faker } from '@faker-js/faker';
import { executeGraphQLRequest } from '../../graphql';
import {
  getAgencyUrl,
  fetchContacts,
  assertEqual,
  assertDefined,
} from '../helpers';

export const name = 'CommentCreate → CommentUpdate → CommentDelete';

export async function run(pool: Pool): Promise<void> {
  const agencyUrl = await getAgencyUrl();
  const contacts = await fetchContacts(pool, 1);

  // ── Step 1: Create Comment ──
  console.log('  Creating comment...');

  const createData = {
    content: faker.lorem.paragraph(),
    type: 'GENERAL',
    subtype: faker.lorem.word(),
    important: true,
    contactId: Number(contacts[0].id),
  };

  const createMutation = `
    mutation commentCreate($attributes: CommentAttributes!) {
      commentCreate(attributes: $attributes) {
        comment {
          id
          content
          type
          subtype
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

  const { comment, error: createError } = createResult.commentCreate;
  assertEqual('create error should be null', createError, null);
  assertDefined('comment should exist', comment);
  assertDefined('comment.id should exist', comment.id);

  console.log(`  Comment created with id: ${comment.id}`);

  // Verify created data
  console.log('  Verifying created comment...');
  assertEqual('content', comment.content, createData.content);
  assertEqual('type', comment.type, createData.type);
  assertEqual('subtype', comment.subtype, createData.subtype);

  // ── Step 2: Update Comment ──
  console.log('  Updating comment...');

  const updateData = {
    content: faker.lorem.paragraph(),
    important: false,
  };

  const updateMutation = `
    mutation commentUpdate($id: ID!, $attributes: CommentAttributes!) {
      commentUpdate(id: $id, attributes: $attributes) {
        comment {
          id
          content
        }
        error
      }
    }
  `;

  const updateResult = await executeGraphQLRequest({
    endpoint: agencyUrl,
    query: updateMutation,
    variables: { id: comment.id, attributes: updateData },
  }, 1);

  const { comment: updated, error: updateError } = updateResult.commentUpdate;
  assertEqual('update error should be null', updateError, null);
  assertDefined('updated comment should exist', updated);

  console.log('  Verifying updated comment...');
  assertEqual('updated content', updated.content, updateData.content);

  // ── Step 3: Delete Comment ──
  console.log('  Deleting comment...');

  const deleteMutation = `
    mutation commentDelete($id: ID!) {
      commentDelete(id: $id) {
        error
      }
    }
  `;

  const deleteResult = await executeGraphQLRequest({
    endpoint: agencyUrl,
    query: deleteMutation,
    variables: { id: comment.id },
  }, 1);

  assertEqual('delete error should be null', deleteResult.commentDelete.error, null);
  console.log(`  Comment ${comment.id} deleted successfully`);
}
