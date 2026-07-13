import { Pool } from 'pg';
import { faker } from '@faker-js/faker';
import { executeGraphQLRequest } from '../../graphql';
import {
  getAgencyUrl,
  fetchActiveSalesListing,
  assertEqual,
  assertDefined,
} from '../helpers';

export const name = 'ListingTagTypeCrud';

export async function run(pool: Pool): Promise<void> {
  const agencyUrl = await getAgencyUrl();
  const listing = await fetchActiveSalesListing(pool);

  // ── Create Listing Tag ──
  const tagName = `Listing Tag ${faker.string.alphanumeric(8)}`;
  console.log(`  Creating listing tag type with name: "${tagName}"...`);

  const createMutation = `
    mutation listingTagTypeCreate($attributes: ListingTagTypeAttributes!) {
      listingTagTypeCreate(attributes: $attributes) {
        listingTag {
          id
          name
          color
        }
        error
      }
    }
  `;

  const createResult = await executeGraphQLRequest({
    endpoint: agencyUrl,
    query: createMutation,
    variables: { attributes: { name: tagName } },
  }, 1);

  const { listingTag: createdTag, error: createError } = createResult.listingTagTypeCreate;
  assertEqual('create error should be null', createError, null);
  assertDefined('listingTag should exist', createdTag);
  assertDefined('listingTag.id should exist', createdTag.id);
  assertEqual('listingTag.name', createdTag.name, tagName);
  assertDefined('listingTag.color should exist', createdTag.color);

  const tagId = createdTag.id;
  console.log(`  Listing tag created with id: ${tagId}, color: ${createdTag.color}`);

  // ── Update Listing Tag ──
  const updatedName = `Updated Tag ${faker.string.alphanumeric(8)}`;
  console.log(`  Updating listing tag ${tagId} to name: "${updatedName}"...`);

  const updateMutation = `
    mutation listingTagTypeUpdate($attributes: ListingTagTypeUpdateAttributes!) {
      listingTagTypeUpdate(attributes: $attributes) {
        listingTag {
          id
          name
          color
        }
        error
      }
    }
  `;

  const updateResult = await executeGraphQLRequest({
    endpoint: agencyUrl,
    query: updateMutation,
    variables: { attributes: { id: tagId, name: updatedName } },
  }, 1);

  const { listingTag: updatedTag, error: updateError } = updateResult.listingTagTypeUpdate;
  assertEqual('update error should be null', updateError, null);
  assertDefined('updated listingTag should exist', updatedTag);
  assertEqual('updated listingTag.id', updatedTag.id, tagId);
  assertEqual('updated listingTag.name', updatedTag.name, updatedName);

  console.log(`  Listing tag updated`);

  // ── Assign Listing Tag to Sales Listing (via listingAssignTag) ──
  console.log(`  Assigning listing tag ${tagId} to sales listing ${listing.id}...`);

  const assignMutation = `
    mutation listingAssignTag($attributes: ListingTagAttributes!) {
      listingAssignTag(attributes: $attributes) {
        success
        error
      }
    }
  `;

  const assignResult = await executeGraphQLRequest({
    endpoint: agencyUrl,
    query: assignMutation,
    variables: { attributes: { salesListingId: listing.id, tagId } },
  }, 1);

  const { success: assignSuccess, error: assignError } = assignResult.listingAssignTag;
  assertEqual('assign error should be null', assignError, null);
  assertEqual('assign success', assignSuccess, true);

  console.log(`  Listing tag assigned to sales listing ${listing.id}`);

  // ── Unassign Listing Tag from Sales Listing ──
  console.log(`  Unassigning listing tag ${tagId} from sales listing ${listing.id}...`);

  const unassignMutation = `
    mutation listingUnassignTag($attributes: ListingTagAttributes!) {
      listingUnassignTag(attributes: $attributes) {
        success
        error
      }
    }
  `;

  const unassignResult = await executeGraphQLRequest({
    endpoint: agencyUrl,
    query: unassignMutation,
    variables: { attributes: { salesListingId: listing.id, tagId } },
  }, 1);

  const { success: unassignSuccess, error: unassignError } = unassignResult.listingUnassignTag;
  assertEqual('unassign error should be null', unassignError, null);
  assertEqual('unassign success', unassignSuccess, true);

  console.log(`  Listing tag unassigned from sales listing ${listing.id}`);

  // ── Delete Listing Tag ──
  console.log(`  Deleting listing tag ${tagId}...`);

  const deleteMutation = `
    mutation listingTagTypeDelete($attributes: ListingTagTypeDeleteAttributes!) {
      listingTagTypeDelete(attributes: $attributes) {
        id
        deleted
        error
      }
    }
  `;

  const deleteResult = await executeGraphQLRequest({
    endpoint: agencyUrl,
    query: deleteMutation,
    variables: { attributes: { id: tagId } },
  }, 1);

  const { id: deletedId, deleted, error: deleteError } = deleteResult.listingTagTypeDelete;
  assertEqual('delete error should be null', deleteError, null);
  assertEqual('deleted should be true', deleted, true);
  assertDefined('deleted id should exist', deletedId);

  console.log(`  Listing tag ${deletedId} deleted`);
}
