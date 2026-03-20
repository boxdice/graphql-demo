import { Pool } from 'pg';
import { faker } from '@faker-js/faker';
import { executeGraphQLRequest } from '../../graphql';
import {
  getAgencyUrl,
  assertEqual,
  assertDefined,
} from '../helpers';

export const name = 'ContactCategoryTypeCrud';

export async function run(pool: Pool): Promise<void> {
  const agencyUrl = await getAgencyUrl();

  // ── Create ──
  const categoryName = `Test Category ${faker.string.alphanumeric(8)}`;
  console.log(`  Creating contact category type with name: "${categoryName}"...`);

  const createMutation = `
    mutation contactCategoryTypeCreate($attributes: ContactCategoryTypeAttributes!) {
      contactCategoryTypeCreate(attributes: $attributes) {
        contactCategoryType {
          id
          name
          enabled
        }
        error
      }
    }
  `;

  const createResult = await executeGraphQLRequest({
    endpoint: agencyUrl,
    query: createMutation,
    variables: { attributes: { name: categoryName } },
  }, 1);

  const { contactCategoryType: created, error: createError } = createResult.contactCategoryTypeCreate;
  assertEqual('create error should be null', createError, null);
  assertDefined('contactCategoryType should exist', created);
  assertDefined('contactCategoryType.id should exist', created.id);
  assertEqual('contactCategoryType.name', created.name, categoryName);

  const categoryId = created.id;
  console.log(`  Contact category type created with id: ${categoryId}`);

  // ── Update ──
  const updatedName = `Updated Category ${faker.string.alphanumeric(8)}`;
  console.log(`  Updating contact category type ${categoryId} to name: "${updatedName}"...`);

  const updateMutation = `
    mutation contactCategoryTypeUpdate($id: ID!, $attributes: ContactCategoryTypeAttributes!) {
      contactCategoryTypeUpdate(id: $id, attributes: $attributes) {
        contactCategoryType {
          id
          name
          enabled
        }
        error
      }
    }
  `;

  const updateResult = await executeGraphQLRequest({
    endpoint: agencyUrl,
    query: updateMutation,
    variables: { id: categoryId, attributes: { name: updatedName } },
  }, 1);

  const { contactCategoryType: updated, error: updateError } = updateResult.contactCategoryTypeUpdate;
  assertEqual('update error should be null', updateError, null);
  assertDefined('updated contactCategoryType should exist', updated);
  assertEqual('updated id', updated.id, categoryId);
  assertEqual('updated name', updated.name, updatedName);

  console.log(`  Contact category type updated`);

  // ── Delete ──
  console.log(`  Deleting contact category type ${categoryId}...`);

  const deleteMutation = `
    mutation contactCategoryTypeDelete($id: ID!) {
      contactCategoryTypeDelete(id: $id) {
        id
        name
        deleted
        error
      }
    }
  `;

  const deleteResult = await executeGraphQLRequest({
    endpoint: agencyUrl,
    query: deleteMutation,
    variables: { id: categoryId },
  }, 1);

  const { id: deletedId, name: deletedName, deleted, error: deleteError } = deleteResult.contactCategoryTypeDelete;
  assertEqual('delete error should be null', deleteError, null);
  assertEqual('deleted should be true', deleted, true);
  assertDefined('deleted id should exist', deletedId);
  assertEqual('deleted name', deletedName, updatedName);

  console.log(`  Contact category type ${deletedId} deleted`);
}
