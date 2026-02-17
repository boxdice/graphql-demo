import { Pool } from 'pg';
import { faker } from '@faker-js/faker';
import { executeGraphQLRequest } from '../../graphql';
import {
  getAgencyUrl,
  fetchActiveSalesListing,
  assertEqual,
  assertDefined,
} from '../helpers';

export const name = 'PropertyTagCrud';

export async function run(pool: Pool): Promise<void> {
  const agencyUrl = await getAgencyUrl();
  const listing = await fetchActiveSalesListing(pool);
  const propertyId = listing.propertyId;

  // ── Create Tag ──
  const tagName = `Test Tag ${faker.string.alphanumeric(8)}`;
  console.log(`  Creating property tag type with name: "${tagName}"...`);

  const createMutation = `
    mutation propertyTagTypeCreate($attributes: PropertyTagTypeAttributes!) {
      propertyTagTypeCreate(attributes: $attributes) {
        propertyTag {
          id
          name
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

  const { propertyTag, error: createError } = createResult.propertyTagTypeCreate;
  assertEqual('create error should be null', createError, null);
  assertDefined('propertyTag should exist', propertyTag);
  assertDefined('propertyTag.id should exist', propertyTag.id);
  assertEqual('propertyTag.name', propertyTag.name, tagName);

  const tagId = propertyTag.id;
  console.log(`  Property tag created with id: ${tagId}`);

  // ── Assign Tag to Property ──
  console.log(`  Assigning tag ${tagId} to property ${propertyId}...`);

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
  assertDefined('assigned propertyTag should exist', assignedTag);
  assertEqual('assigned tag name', assignedTag.name, tagName);

  console.log(`  Tag assigned to property ${assignedProperty.id}`);

  // ── Unassign Tag from Property ──
  console.log(`  Unassigning tag ${tagId} from property ${propertyId}...`);

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

  const { property: unassignedProperty, propertyTag: unassignedTag, error: unassignError } = unassignResult.propertyUnassignTag;
  assertEqual('unassign error should be null', unassignError, null);
  assertDefined('unassigned property should exist', unassignedProperty);
  assertDefined('unassigned propertyTag should exist', unassignedTag);

  console.log(`  Tag unassigned from property ${unassignedProperty.id}`);
}
