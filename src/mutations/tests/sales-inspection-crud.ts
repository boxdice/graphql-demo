import { Pool } from 'pg';
import { executeGraphQLRequest } from '../../graphql';
import {
  getAgencyUrl,
  fetchActiveSalesListing,
  assertEqual,
  assertDefined,
} from '../helpers';

export const name = 'SalesInspectionCreate → SalesInspectionUpdate';

export async function run(pool: Pool): Promise<void> {
  const agencyUrl = await getAgencyUrl();

  const listing = await fetchActiveSalesListing(pool);
  console.log(`  Using sales listing: ${listing.id} (${listing.status})`);

  // ── Step 1: Create SalesInspection ──
  console.log('  Creating sales inspection...');

  const createData = {
    salesListingId: listing.id,
    inspectionDate: '2025-08-20',
    startTime: '11:00',
    endTime: '11:30',
  };

  const createResult = await executeGraphQLRequest({
    endpoint: agencyUrl,
    query: `
      mutation salesInspectionCreate($attributes: SalesInspectionCreateAttributes!) {
        salesInspectionCreate(attributes: $attributes) {
          salesInspection {
            id
            inspectionDate
            salesListingId
          }
          error
        }
      }
    `,
    variables: { attributes: createData },
  }, 1);

  const { salesInspection, error: createError } = createResult.salesInspectionCreate;
  assertEqual('create error', createError, null);
  assertDefined('salesInspection', salesInspection);
  assertDefined('salesInspection.id', salesInspection.id);
  assertEqual('inspectionDate', salesInspection.inspectionDate, createData.inspectionDate);
  console.log(`  Sales inspection created: ${salesInspection.id}`);

  // ── Step 2: Update SalesInspection ──
  console.log('  Updating sales inspection...');

  const updateData = {
    inspectionDate: '2025-09-25',
    startTime: '15:00',
    endTime: '15:30',
  };

  const updateResult = await executeGraphQLRequest({
    endpoint: agencyUrl,
    query: `
      mutation salesInspectionUpdate($id: ID!, $attributes: SalesInspectionUpdateAttributes!) {
        salesInspectionUpdate(id: $id, attributes: $attributes) {
          salesInspection {
            id
            inspectionDate
          }
          error
        }
      }
    `,
    variables: { id: salesInspection.id, attributes: updateData },
  }, 1);

  const { salesInspection: updated, error: updateError } = updateResult.salesInspectionUpdate;
  assertEqual('update error', updateError, null);
  assertDefined('updated salesInspection', updated);
  assertEqual('updated inspectionDate', updated.inspectionDate, updateData.inspectionDate);
  console.log(`  Sales inspection updated: ${updated.id}, date=${updated.inspectionDate}`);
}
