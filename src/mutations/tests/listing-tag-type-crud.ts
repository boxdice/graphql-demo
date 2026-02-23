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
  const propertyId = listing.propertyId;

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

  // ── Assign Listing Tag to Property (via propertyAssignTag) ──
  console.log(`  Assigning listing tag ${tagId} to property ${propertyId}...`);

  const assignMutation = `
    mutation propertyAssignTag($attributes: PropertyTagAssignmentAttributes!) {
      propertyAssignTag(attributes: $attributes) {
        property {
          id
        }
        propertyTag {
          id
          name
        }
        error
      }
    }
  `;

  const assignResult = await executeGraphQLRequest({
    endpoint: agencyUrl,
    query: assignMutation,
    variables: { attributes: { propertyId, tagId } },
  }, 1);

  const { property: assignedProperty, propertyTag: assignedTag, error: assignError } = assignResult.propertyAssignTag;
  assertEqual('assign error should be null', assignError, null);
  assertDefined('assigned property should exist', assignedProperty);
  assertDefined('assigned tag should exist', assignedTag);
  assertEqual('assigned tag name', assignedTag.name, updatedName);

  console.log(`  Listing tag assigned to property ${assignedProperty.id}`);

  // ── Unassign Listing Tag from Property ──
  console.log(`  Unassigning listing tag ${tagId} from property ${propertyId}...`);

  const unassignMutation = `
    mutation propertyUnassignTag($attributes: PropertyTagAssignmentAttributes!) {
      propertyUnassignTag(attributes: $attributes) {
        property {
          id
        }
        propertyTag {
          id
          name
        }
        error
      }
    }
  `;

  const unassignResult = await executeGraphQLRequest({
    endpoint: agencyUrl,
    query: unassignMutation,
    variables: { attributes: { propertyId, tagId } },
  }, 1);

  const { property: unassignedProperty, error: unassignError } = unassignResult.propertyUnassignTag;
  assertEqual('unassign error should be null', unassignError, null);
  assertDefined('unassigned property should exist', unassignedProperty);

  console.log(`  Listing tag unassigned from property ${unassignedProperty.id}`);

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
