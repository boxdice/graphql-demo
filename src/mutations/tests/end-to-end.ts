import { Pool } from 'pg';
import { faker } from '@faker-js/faker';
import { executeGraphQLRequest } from '../../graphql';
import {
  getAgencyUrl,
  fetchOffice,
  fetchActiveConsultants,
  fetchSource,
  fetchSalesListingType,
  fetchPropertyTypeByName,
  assertEqual,
  assertEqualIgnoreCase,
  assertDefined,
} from '../helpers';

export const name = 'EndToEnd: Property → Appraisal → Listing → Voucher → Enquiry → AML → Sold';

export async function run(pool: Pool): Promise<void> {
  const agencyUrl = await getAgencyUrl();

  // ── Gather reference data ──
  console.log('  Gathering reference data from local DB...');
  const office = await fetchOffice(pool);
  const consultants = await fetchActiveConsultants(pool, 3);
  const source = await fetchSource(pool);
  const listingType = await fetchSalesListingType(pool);
  const propertyType = await fetchPropertyTypeByName(pool, 'Residential');

  console.log(`    office: ${office.id}, propertyType: ${propertyType.id} (${propertyType.name})`);
  console.log(`    consultants: ${consultants.map(c => c.id).join(', ')}`);

  // ══════════════════════════════════════════════════════════════════
  // Step 1: Create a Contact (vendor)
  // ══════════════════════════════════════════════════════════════════
  console.log('  [1] Creating vendor contact...');

  const vendorData = {
    firstName: faker.person.firstName(),
    lastName: faker.person.lastName(),
    email: faker.internet.email(),
    mobile: faker.string.numeric(10),
  };

  const contactCreateMutation = `
    mutation contactCreate($attributes: ContactAttributes!) {
      contactCreate(attributes: $attributes) {
        contact { id firstName lastName email }
        error
      }
    }
  `;

  const vendorResult = await executeGraphQLRequest({
    endpoint: agencyUrl,
    query: contactCreateMutation,
    variables: { attributes: vendorData },
  }, 1);

  const { contact: vendor, error: vendorError } = vendorResult.contactCreate;
  assertEqual('vendor create error', vendorError, null);
  assertDefined('vendor should exist', vendor);
  console.log(`      Vendor created: ${vendor.id} (${vendor.firstName} ${vendor.lastName})`);

  // ══════════════════════════════════════════════════════════════════
  // Step 2: Create a Property
  // ══════════════════════════════════════════════════════════════════
  console.log('  [2] Creating property...');

  const propertyData = {
    streetName: faker.location.street(),
    streetType: 'Street',
    number: String(faker.number.int({ min: 1, max: 200 })),
    suburb: 'Footscray',
    state: 'VIC',
    postcode: '3011',
    country: 'Australia',
    typeId: String(propertyType.id),
    beds: faker.number.int({ min: 2, max: 5 }),
    baths: faker.number.int({ min: 1, max: 3 }),
    carspaces: faker.number.int({ min: 1, max: 3 }),
  };

  const propertyCreateMutation = `
    mutation propertyCreate($attributes: PropertyAttributes!) {
      propertyCreate(attributes: $attributes) {
        property { id streetName suburb state postcode beds baths carspaces }
        error
      }
    }
  `;

  const propertyResult = await executeGraphQLRequest({
    endpoint: agencyUrl,
    query: propertyCreateMutation,
    variables: { attributes: propertyData },
  }, 1);

  const { property, error: propertyError } = propertyResult.propertyCreate;
  assertEqual('property create error', propertyError, null);
  assertDefined('property should exist', property);
  assertEqualIgnoreCase('suburb', property.suburb, 'FOOTSCRAY');
  assertEqual('postcode', property.postcode, '3011');
  assertEqual('beds', property.beds, propertyData.beds);

  const propertyId = property.id;
  console.log(`      Property created: ${propertyId} — ${propertyData.number} ${propertyData.streetName} St, Footscray`);

  // ══════════════════════════════════════════════════════════════════
  // Step 3: Create an Appraisal for that property + vendor
  // ══════════════════════════════════════════════════════════════════
  console.log('  [3] Creating appraisal...');

  const appraisalData = {
    propertyId: Number(propertyId),
    officeId: Number(office.id),
    consultantId: Number(consultants[0].id),
    consultant1Id: Number(consultants[0].id),
    consultant2Id: consultants[1] ? Number(consultants[1].id) : undefined,
    contactIds: [Number(vendor.id)],
    listingTypeId: Number(listingType.id),
    listingSourceId: Number(source.id),
    apprPriceFrom: faker.number.int({ min: 600000, max: 700000 }),
    apprPriceTo: faker.number.int({ min: 800000, max: 900000 }),
    expectedCommission: faker.number.int({ min: 10000, max: 25000 }),
    appDate: '2026-03-15',
    closeLikelihood: 'LIKELY',
  };

  const appraisalCreateMutation = `
    mutation appraisalCreate($attributes: AppraisalCreateAttributes!) {
      appraisalCreate(attributes: $attributes) {
        appraisal { id status apprPriceFrom apprPriceTo }
        error
      }
    }
  `;

  const appraisalResult = await executeGraphQLRequest({
    endpoint: agencyUrl,
    query: appraisalCreateMutation,
    variables: { attributes: appraisalData },
  }, 1);

  const { appraisal, error: appraisalError } = appraisalResult.appraisalCreate;
  assertEqual('appraisal create error', appraisalError, null);
  assertDefined('appraisal should exist', appraisal);
  assertEqual('apprPriceFrom', appraisal.apprPriceFrom, appraisalData.apprPriceFrom);
  assertEqual('apprPriceTo', appraisal.apprPriceTo, appraisalData.apprPriceTo);

  const appraisalId = appraisal.id;
  console.log(`      Appraisal created: ${appraisalId} (status: ${appraisal.status})`);

  // ══════════════════════════════════════════════════════════════════
  // Step 4: Update the Appraisal
  // ══════════════════════════════════════════════════════════════════
  console.log('  [4] Updating appraisal...');

  const newPriceFrom = faker.number.int({ min: 650000, max: 750000 });
  const newPriceTo = faker.number.int({ min: 850000, max: 950000 });

  const appraisalUpdateMutation = `
    mutation appraisalUpdate($attributes: AppraisalUpdateAttributes!) {
      appraisalUpdate(attributes: $attributes) {
        appraisal { id apprPriceFrom apprPriceTo }
        error
      }
    }
  `;

  const appraisalUpdateResult = await executeGraphQLRequest({
    endpoint: agencyUrl,
    query: appraisalUpdateMutation,
    variables: { attributes: { id: appraisalId, apprPriceFrom: newPriceFrom, apprPriceTo: newPriceTo } },
  }, 1);

  const { appraisal: updatedAppraisal, error: appraisalUpdateError } = appraisalUpdateResult.appraisalUpdate;
  assertEqual('appraisal update error', appraisalUpdateError, null);
  assertDefined('updated appraisal should exist', updatedAppraisal);
  assertEqual('updated apprPriceFrom', updatedAppraisal.apprPriceFrom, newPriceFrom);
  assertEqual('updated apprPriceTo', updatedAppraisal.apprPriceTo, newPriceTo);

  console.log(`      Appraisal updated: price range ${newPriceFrom} - ${newPriceTo}`);

  // ══════════════════════════════════════════════════════════════════
  // Step 5: List the Appraisal (promote to Sales Listing)
  // ══════════════════════════════════════════════════════════════════
  console.log('  [5] Listing appraisal (promote to sales listing)...');

  const listMutation = `
    mutation salesAppraisalList($appraisalId: ID!) {
      salesAppraisalList(appraisalId: $appraisalId) {
        salesListing { id status dateListed }
        error
      }
    }
  `;

  const listResult = await executeGraphQLRequest({
    endpoint: agencyUrl,
    query: listMutation,
    variables: { appraisalId: Number(appraisalId) },
  }, 1);

  const { salesListing: listing, error: listError } = listResult.salesAppraisalList;
  assertEqual('list error', listError, null);
  assertDefined('salesListing should exist', listing);

  const listingId = listing.id;
  console.log(`      Sales listing created: ${listingId} (status: ${listing.status})`);

  // ══════════════════════════════════════════════════════════════════
  // Step 6: Update the Sales Listing
  // ══════════════════════════════════════════════════════════════════
  console.log('  [6] Updating sales listing...');

  const listingUpdateData = {
    listingTypeId: Number(listingType.id),
    dateListed: '2026-03-01',
    listingSourceId: Number(source.id),
    campaignStartDate: '2026-03-15',
    displayPrice: `$${faker.number.int({ min: 700000, max: 900000 }).toLocaleString()}`,
    priceFrom: faker.number.int({ min: 650000, max: 750000 }),
    priceTo: faker.number.int({ min: 800000, max: 900000 }),
    consultant1Id: Number(consultants[0].id),
    consultant2Id: consultants[1] ? Number(consultants[1].id) : undefined,
    reportingOfficeId: Number(office.id),

    websiteStatus: 'CURRENT',
    vendorContactIds: [Number(vendor.id)],
  };

  const listingUpdateMutation = `
    mutation salesListingUpdate($id: ID!, $attributes: SalesListingUpdateAttributes!) {
      salesListingUpdate(id: $id, attributes: $attributes) {
        salesListing { id status dateListed displayPrice priceFrom priceTo websiteStatus salesVoucherId }
        error
      }
    }
  `;

  const listingUpdateResult = await executeGraphQLRequest({
    endpoint: agencyUrl,
    query: listingUpdateMutation,
    variables: { id: Number(listingId), attributes: listingUpdateData },
  }, 1);

  const { salesListing: updatedListing, error: listingUpdateError } = listingUpdateResult.salesListingUpdate;
  assertEqual('listing update error', listingUpdateError, null);
  assertDefined('updated listing should exist', updatedListing);
  assertEqual('dateListed', updatedListing.dateListed, listingUpdateData.dateListed);
  assertEqual('displayPrice', updatedListing.displayPrice, listingUpdateData.displayPrice);
  assertEqual('priceFrom', updatedListing.priceFrom, listingUpdateData.priceFrom);
  assertEqual('priceTo', updatedListing.priceTo, listingUpdateData.priceTo);

  console.log(`      Listing updated: ${updatedListing.displayPrice}`);

  // ══════════════════════════════════════════════════════════════════
  // Step 7: Update the Sales Voucher
  // ══════════════════════════════════════════════════════════════════
  console.log('  [7] Updating sales voucher...');

  // The voucher is auto-created when the listing is created.
  // We already have the salesVoucherId from the listing update response (step 6).
  let voucherId: string | null = updatedListing.salesVoucherId ?? null;

  if (voucherId) {
    const salePrice = faker.number.int({ min: 700000, max: 900000 });

    const voucherUpdateMutation = `
      mutation salesVoucherUpdate($attributes: SalesVoucherAttributes!) {
        salesVoucherUpdate(attributes: $attributes) {
          salesVoucher { id saleDate salePrice saleStatus }
          error
        }
      }
    `;

    const voucherUpdateResult = await executeGraphQLRequest({
      endpoint: agencyUrl,
      query: voucherUpdateMutation,
      variables: {
        attributes: {
          id: Number(voucherId),
          saleDate: '2026-06-15',
          salePrice,
          saleStatus: 'PRIVATE_SALE',
          recordPrice: false,
        },
      },
    }, 1);

    const { salesVoucher: updatedVoucher, error: voucherError } = voucherUpdateResult.salesVoucherUpdate;
    assertEqual('voucher update error', voucherError, null);
    assertDefined('updated voucher should exist', updatedVoucher);
    assertEqual('salePrice', updatedVoucher.salePrice, salePrice);

    console.log(`      Voucher ${updatedVoucher.id} updated: $${salePrice}`);
  } else {
    console.log('      Voucher not found for this listing — skipping voucher update');
  }

  // ══════════════════════════════════════════════════════════════════
  // Step 8: Create a buyer Contact
  // ══════════════════════════════════════════════════════════════════
  console.log('  [8] Creating buyer contact...');

  const buyerData = {
    firstName: faker.person.firstName(),
    lastName: faker.person.lastName(),
    email: faker.internet.email(),
    mobile: faker.string.numeric(10),
  };

  const buyerResult = await executeGraphQLRequest({
    endpoint: agencyUrl,
    query: contactCreateMutation,
    variables: { attributes: buyerData },
  }, 1);

  const { contact: buyer, error: buyerError } = buyerResult.contactCreate;
  assertEqual('buyer create error', buyerError, null);
  assertDefined('buyer should exist', buyer);

  console.log(`      Buyer created: ${buyer.id} (${buyer.firstName} ${buyer.lastName})`);

  // ══════════════════════════════════════════════════════════════════
  // Step 9: Create an Enquiry from the buyer on the listing
  // ══════════════════════════════════════════════════════════════════
  console.log('  [9] Creating enquiry from buyer on listing...');

  const enquiryData = {
    from: buyerData.email,
    messageId: faker.string.uuid(),
    subject: `Enquiry about ${propertyData.number} ${propertyData.streetName} St`,
    message: faker.lorem.paragraph(),
    salesListingId: Number(listingId),
    consultantId: Number(consultants[0].id),
    contactId: Number(buyer.id),
    contactName: `${buyerData.firstName} ${buyerData.lastName}`,
    contactEmail: buyerData.email,
    contactPhone: buyerData.mobile,
  };

  const enquiryCreateMutation = `
    mutation enquiryCreate($attributes: EnquiryAttributes!) {
      enquiryCreate(attributes: $attributes) {
        enquiry { id salesListingId contactName contactEmail message }
        error
      }
    }
  `;

  const enquiryResult = await executeGraphQLRequest({
    endpoint: agencyUrl,
    query: enquiryCreateMutation,
    variables: { attributes: enquiryData },
  }, 1);

  const { enquiry, error: enquiryError } = enquiryResult.enquiryCreate;
  assertEqual('enquiry create error', enquiryError, null);
  assertDefined('enquiry should exist', enquiry);
  assertEqual('enquiry contactName', enquiry.contactName, enquiryData.contactName);
  assertEqual('enquiry salesListingId', String(enquiry.salesListingId), String(listingId));

  console.log(`      Enquiry created: ${enquiry.id}`);

  // ══════════════════════════════════════════════════════════════════
  // Step 10: Create AML check (completed) on the buyer
  // ══════════════════════════════════════════════════════════════════
  console.log('  [10] Creating AML due diligence check on buyer...');

  const amlCreateMutation = `
    mutation amlDueDiligenceCheckCreate($attributes: AmlDueDiligenceCheckAttributes!) {
      amlDueDiligenceCheckCreate(attributes: $attributes) {
        amlDueDiligenceCheck { id status }
        error
      }
    }
  `;

  const amlResult = await executeGraphQLRequest({
    endpoint: agencyUrl,
    query: amlCreateMutation,
    variables: {
      attributes: {
        contactId: Number(buyer.id),
        status: 'completed',
        note: `AML check completed for ${buyerData.firstName} ${buyerData.lastName}`,
      },
    },
  }, 1);

  const { amlDueDiligenceCheck: amlCheck, error: amlError } = amlResult.amlDueDiligenceCheckCreate;
  assertEqual('AML create error', amlError, null);
  assertDefined('AML check should exist', amlCheck);

  console.log(`      AML check created: ${amlCheck.id} (status: ${amlCheck.status})`);

  // Assign the AML check to the listing
  console.log('      Assigning AML check to listing...');

  const amlAssignMutation = `
    mutation amlDueDiligenceCheckAssignListing($amlDueDiligenceCheckId: ID!, $salesListingId: ID!) {
      amlDueDiligenceCheckAssignListing(amlDueDiligenceCheckId: $amlDueDiligenceCheckId, salesListingId: $salesListingId) {
        error
      }
    }
  `;

  const amlAssignResult = await executeGraphQLRequest({
    endpoint: agencyUrl,
    query: amlAssignMutation,
    variables: {
      amlDueDiligenceCheckId: amlCheck.id,
      salesListingId: listingId,
    },
  }, 1);

  assertEqual('AML assign error', amlAssignResult.amlDueDiligenceCheckAssignListing.error, null);
  console.log('      AML check assigned to listing');

  // ══════════════════════════════════════════════════════════════════
  // Step 11: Mark the listing as sold
  // ══════════════════════════════════════════════════════════════════
  console.log('  [11] Marking listing as sold...');

  const markSoldMutation = `
    mutation salesListingMarkSold($attributes: SalesListingSoldAttributes!) {
      salesListingMarkSold(attributes: $attributes) {
        salesListing { id status }
        error
      }
    }
  `;

  const soldResult = await executeGraphQLRequest({
    endpoint: agencyUrl,
    query: markSoldMutation,
    variables: {
      attributes: {
        salesListingId: Number(listingId),
        consultantId: Number(consultants[0].id),
        keepInspections: 'false',
      },
    },
  }, 1);

  const { salesListing: soldListing, error: soldError } = soldResult.salesListingMarkSold;
  assertEqual('mark sold error', soldError, null);
  assertDefined('sold listing should exist', soldListing);

  console.log(`      Listing ${soldListing.id} marked as sold (status: ${soldListing.status})`);

  // ══════════════════════════════════════════════════════════════════
  // Step 12: Add PURCHASER contact activity (buyer ↔ listing)
  // NOTE: contactActivityCreate is not yet implemented in pro
  // ══════════════════════════════════════════════════════════════════
  console.log('  [12] Contact activity (PURCHASER) — skipped (not yet implemented in pro)');

  console.log('  End-to-end flow complete.');
}
