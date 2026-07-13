import { Pool } from 'pg';
import { faker } from '@faker-js/faker';
import { executeGraphQLRequest } from '../../graphql';
import {
  getAgencyUrl,
  fetchContacts,
  fetchActiveConsultant,
  assertEqual,
  assertDefined,
} from '../helpers';

export const name = 'ContactAssignCategory';

export async function run(pool: Pool): Promise<void> {
  const agencyUrl = await getAgencyUrl();
  const [contact] = await fetchContacts(pool, 1);
  const consultant = await fetchActiveConsultant(pool);

  // ── Create a category type to work with ──
  const categoryName = `Test Assign Category ${faker.string.alphanumeric(8)}`;
  console.log(`  Creating contact category type "${categoryName}"...`);

  const createTypeMutation = `
    mutation contactCategoryTypeCreate($attributes: ContactCategoryTypeAttributes!) {
      contactCategoryTypeCreate(attributes: $attributes) {
        contactCategoryType {
          id
          name
        }
        error
      }
    }
  `;

  const createTypeResult = await executeGraphQLRequest({
    endpoint: agencyUrl,
    query: createTypeMutation,
    variables: { attributes: { name: categoryName } },
  }, 1);

  const { contactCategoryType: createdType, error: createTypeError } = createTypeResult.contactCategoryTypeCreate;
  assertEqual('create type error should be null', createTypeError, null);
  assertDefined('category type should exist', createdType);

  const categoryTypeId = createdType.id;
  console.log(`  Category type created with id: ${categoryTypeId}`);

  // ── Assign category to contact ──
  console.log(`  Assigning category ${categoryTypeId} to contact ${contact.id}...`);

  const assignMutation = `
    mutation contactAssignCategory($attributes: ContactCategoryAttributes!) {
      contactAssignCategory(attributes: $attributes) {
        id
        contactId
        consultantId
        categoryTypeId
        categoryName
        error
      }
    }
  `;

  const assignResult = await executeGraphQLRequest({
    endpoint: agencyUrl,
    query: assignMutation,
    variables: {
      attributes: {
        contactId: contact.id,
        consultantId: consultant.id,
        categoryTypeId,
      },
    },
  }, 1);

  const assigned = assignResult.contactAssignCategory;
  assertEqual('assign error should be null', assigned.error, null);
  assertDefined('assigned id should exist', assigned.id);
  assertEqual('assigned contactId', String(assigned.contactId), String(contact.id));
  assertEqual('assigned consultantId', String(assigned.consultantId), String(consultant.id));
  assertEqual('assigned categoryTypeId', String(assigned.categoryTypeId), String(categoryTypeId));
  assertEqual('assigned categoryName', assigned.categoryName, categoryName);

  console.log(`  Category assigned (id: ${assigned.id})`);

  // ── Unassign category from contact (by triple) ──
  console.log(`  Unassigning category ${categoryTypeId} from contact ${contact.id} (by triple)...`);

  const unassignMutation = `
    mutation contactUnassignCategory($attributes: ContactCategoryAttributes!) {
      contactUnassignCategory(attributes: $attributes) {
        id
        deleted
        error
      }
    }
  `;

  const unassignResult = await executeGraphQLRequest({
    endpoint: agencyUrl,
    query: unassignMutation,
    variables: {
      attributes: {
        contactId: contact.id,
        consultantId: consultant.id,
        categoryTypeId,
      },
    },
  }, 1);

  const unassigned = unassignResult.contactUnassignCategory;
  assertEqual('unassign error should be null', unassigned.error, null);
  assertEqual('unassign deleted should be true', unassigned.deleted, true);
  assertDefined('unassigned id should exist', unassigned.id);

  console.log(`  Category unassigned (id: ${unassigned.id})`);

  // ── Re-assign then unassign by ID ──
  console.log(`  Re-assigning category to test unassign by ID...`);

  const reassignResult = await executeGraphQLRequest({
    endpoint: agencyUrl,
    query: assignMutation,
    variables: {
      attributes: {
        contactId: contact.id,
        consultantId: consultant.id,
        categoryTypeId,
      },
    },
  }, 1);

  const reassigned = reassignResult.contactAssignCategory;
  assertEqual('reassign error should be null', reassigned.error, null);
  assertDefined('reassigned id should exist', reassigned.id);

  const contactCategoryId = reassigned.id;
  console.log(`  Re-assigned (id: ${contactCategoryId}), now unassigning by ID...`);

  const unassignByIdMutation = `
    mutation contactUnassignCategory($attributes: ContactCategoryAttributes!) {
      contactUnassignCategory(attributes: $attributes) {
        id
        deleted
        error
      }
    }
  `;

  const unassignByIdResult = await executeGraphQLRequest({
    endpoint: agencyUrl,
    query: unassignByIdMutation,
    variables: {
      attributes: {
        id: contactCategoryId,
      },
    },
  }, 1);

  const unassignedById = unassignByIdResult.contactUnassignCategory;
  assertEqual('unassign by id error should be null', unassignedById.error, null);
  assertEqual('unassign by id deleted should be true', unassignedById.deleted, true);
  assertEqual('unassign by id should return same id', unassignedById.id, contactCategoryId);

  console.log(`  Category unassigned by ID (id: ${contactCategoryId})`);

  // ── Cleanup: delete the category type ──
  console.log(`  Deleting category type ${categoryTypeId}...`);

  const deleteTypeMutation = `
    mutation contactCategoryTypeDelete($id: ID!) {
      contactCategoryTypeDelete(id: $id) {
        id
        deleted
        error
      }
    }
  `;

  const deleteResult = await executeGraphQLRequest({
    endpoint: agencyUrl,
    query: deleteTypeMutation,
    variables: { id: categoryTypeId },
  }, 1);

  const { deleted, error: deleteError } = deleteResult.contactCategoryTypeDelete;
  assertEqual('delete type error should be null', deleteError, null);
  assertEqual('deleted should be true', deleted, true);

  console.log(`  Category type ${categoryTypeId} deleted`);
}
