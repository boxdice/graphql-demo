import { Pool } from 'pg';
import { executeGraphQLRequest } from '../../graphql';
import {
  getAgencyUrl,
  fetchRentalAppraisal,
  fetchActiveConsultants,
  assertEqual,
  assertDefined,
} from '../helpers';

export const name = 'RentalInspectionCreate → RentalInspectionUpdate → RentalInspectionDelete';

export async function run(pool: Pool): Promise<void> {
  const agencyUrl = await getAgencyUrl();

  const rentalListing = await fetchRentalAppraisal(pool);
  const [consultant, otherConsultant] = await fetchActiveConsultants(pool, 2);
  console.log(`  Using rental listing: ${rentalListing.id}`);

  // ── Step 1: Create RentalInspection ──
  console.log('  Creating rental inspection...');

  const createData = {
    rentalListingId: rentalListing.id,
    inspectionDate: '2025-08-15',
    startTime: '10:00',
    endTime: '10:30',
    consultantId: consultant.id,
  };

  const createResult = await executeGraphQLRequest({
    endpoint: agencyUrl,
    query: `
      mutation rentalInspectionCreate($attributes: RentalInspectionCreateAttributes!) {
        rentalInspectionCreate(attributes: $attributes) {
          rentalInspection {
            id
            inspectionDate
            rentalListingId
          }
          error
        }
      }
    `,
    variables: { attributes: createData },
  }, 1);

  const { rentalInspection, error: createError } = createResult.rentalInspectionCreate;
  assertEqual('create error', createError, null);
  assertDefined('rentalInspection', rentalInspection);
  assertDefined('rentalInspection.id', rentalInspection.id);
  assertEqual('inspectionDate', rentalInspection.inspectionDate, createData.inspectionDate);
  console.log(`  Rental inspection created: ${rentalInspection.id}`);

  // ── Step 2: Update RentalInspection ──
  console.log('  Updating rental inspection...');

  const updateData = {
    inspectionDate: '2025-09-20',
    startTime: '14:00',
    endTime: '14:30',
    consultantId: otherConsultant.id,
  };

  const updateResult = await executeGraphQLRequest({
    endpoint: agencyUrl,
    query: `
      mutation rentalInspectionUpdate($id: ID!, $attributes: RentalInspectionUpdateAttributes!) {
        rentalInspectionUpdate(id: $id, attributes: $attributes) {
          rentalInspection {
            id
            inspectionDate
          }
          error
        }
      }
    `,
    variables: { id: rentalInspection.id, attributes: updateData },
  }, 1);

  const { rentalInspection: updated, error: updateError } = updateResult.rentalInspectionUpdate;
  assertEqual('update error', updateError, null);
  assertDefined('updated rentalInspection', updated);
  assertEqual('updated inspectionDate', updated.inspectionDate, updateData.inspectionDate);
  console.log(`  Rental inspection updated: ${updated.id}, date=${updated.inspectionDate}`);

  // ── Step 3: Delete RentalInspection ──
  console.log('  Deleting rental inspection...');

  const deleteResult = await executeGraphQLRequest({
    endpoint: agencyUrl,
    query: `
      mutation rentalInspectionDelete($id: ID!) {
        rentalInspectionDelete(id: $id) {
          success
          error
        }
      }
    `,
    variables: { id: rentalInspection.id },
  }, 1);

  const { success, error: deleteError } = deleteResult.rentalInspectionDelete;
  assertEqual('delete error', deleteError, null);
  assertEqual('delete success', success, true);
  console.log(`  Rental inspection deleted: ${rentalInspection.id}`);
}
