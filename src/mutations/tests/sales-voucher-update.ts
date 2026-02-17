import { Pool } from 'pg';
import { faker } from '@faker-js/faker';
import { executeGraphQLRequest } from '../../graphql';
import {
  getAgencyUrl,
  fetchSalesVoucher,
  assertEqual,
  assertDefined,
} from '../helpers';

export const name = 'SalesVoucherUpdate';

export async function run(pool: Pool): Promise<void> {
  const agencyUrl = await getAgencyUrl();
  const salesVoucher = await fetchSalesVoucher(pool);

  console.log(`  Found sales voucher id: ${salesVoucher.id} (listing: ${salesVoucher.salesListingId})`);

  // ── Update Sales Voucher ──
  console.log('  Updating sales voucher...');

  const salePrice = faker.number.int({ min: 400000, max: 900000 });
  const fullDepositAmount = faker.number.int({ min: 10000, max: 50000 });

  const updateData = {
    id: Number(salesVoucher.id),
    saleDate: '2026-06-15',
    salePrice,
    saleStatus: 'PRIVATE_SALE',
    recordPrice: false,
    fullDepositAmount,
    depositAmountPaid: faker.number.int({ min: 5000, max: 10000 }),
    depositDueDate: '2026-06-20',
    expDepositReleaseDate: '2026-07-15',
    commissionDrawnDate: '2026-07-20',
    expectedSettlementDate: '2026-08-15',
    actualSettlementDate: '2026-09-01',
    expectedUnconditionalDate: '2026-07-01',
    actualUnconditionalDate: '2026-07-10',
  };

  const mutation = `
    mutation salesVoucherUpdate($attributes: SalesVoucherAttributes!) {
      salesVoucherUpdate(attributes: $attributes) {
        salesVoucher {
          id
          saleDate
          salePrice
          saleStatus
          totalDepositAmount
          expectedDepositReleaseDate
          commissionDrawnDate
          expectedSettlementDate
          actualSettlementDate
          expectedUnconditionalDate
          actualUnconditionalDate
        }
        error
      }
    }
  `;

  const result = await executeGraphQLRequest({
    endpoint: agencyUrl,
    query: mutation,
    variables: { attributes: updateData },
  }, 1);

  const { salesVoucher: updated, error } = result.salesVoucherUpdate;
  assertEqual('error should be null', error, null);
  assertDefined('salesVoucher should exist', updated);
  assertDefined('salesVoucher.id should exist', updated.id);

  console.log(`  Sales voucher ${updated.id} updated`);

  // Verify returned fields
  console.log('  Verifying updated voucher data...');
  assertEqual('saleDate', updated.saleDate, updateData.saleDate);
  assertEqual('salePrice', updated.salePrice, updateData.salePrice);
  assertEqual('saleStatus', updated.saleStatus, 'PS');
  assertEqual('totalDepositAmount', updated.totalDepositAmount, updateData.fullDepositAmount);
  assertEqual('expectedDepositReleaseDate', updated.expectedDepositReleaseDate, updateData.expDepositReleaseDate);
  assertEqual('commissionDrawnDate', updated.commissionDrawnDate, updateData.commissionDrawnDate);
  assertEqual('expectedSettlementDate', updated.expectedSettlementDate, updateData.expectedSettlementDate);
  assertEqual('actualSettlementDate', updated.actualSettlementDate, updateData.actualSettlementDate);
  assertEqual('expectedUnconditionalDate', updated.expectedUnconditionalDate, updateData.expectedUnconditionalDate);
  assertEqual('actualUnconditionalDate', updated.actualUnconditionalDate, updateData.actualUnconditionalDate);
}
