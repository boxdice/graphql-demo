import { Pool } from 'pg';
import { faker } from '@faker-js/faker';
import { executeGraphQLRequest } from '../../graphql';
import {
  getAgencyUrl,
  fetchUnusedProperty,
  fetchOffice,
  fetchActiveConsultants,
  fetchContacts,
  fetchSource,
  fetchSalesListingType,
  assertEqual,
  assertDefined,
} from '../helpers';

export const name = 'AppraisalCreate → SalesAppraisalList → SalesListingUpdate';

export async function run(pool: Pool): Promise<void> {
  const agencyUrl = await getAgencyUrl();

  // Gather test data from local DB
  console.log('  Gathering test data from local DB...');
  const property = await fetchUnusedProperty(pool);
  const office = await fetchOffice(pool);
  const consultants = await fetchActiveConsultants(pool, 3);
  const contacts = await fetchContacts(pool, 2);
  const source = await fetchSource(pool);
  const listingType = await fetchSalesListingType(pool);
  console.log(`    property: ${property.id}, office: ${office.id}`);
  console.log(`    consultants: ${consultants.map(c => c.id).join(', ')}`);
  console.log(`    contacts: ${contacts.map(c => c.id).join(', ')}`);

  // ── Step 1: Create Appraisal ──
  console.log('  Creating appraisal...');

  const appraisalData = {
    propertyId: Number(property.id),
    officeId: Number(office.id),
    consultantId: Number(consultants[0].id),
    consultant1Id: Number(consultants[0].id),
    consultant2Id: consultants[1] ? Number(consultants[1].id) : undefined,
    consultant3Id: consultants[2] ? Number(consultants[2].id) : undefined,
    contactIds: contacts.map(c => Number(c.id)),
    listingTypeId: Number(listingType.id),
    listingSourceId: Number(source.id),
    apprPriceFrom: faker.number.int({ min: 300000, max: 400000 }),
    apprPriceTo: faker.number.int({ min: 500000, max: 700000 }),
    expectedCommission: faker.number.int({ min: 5000, max: 20000 }),
    appDate: '2026-03-15',
    closeLikelihood: 'LIKELY',
  };

  const createAppraisalMutation = `
    mutation appraisalCreate($attributes: AppraisalCreateAttributes!) {
      appraisalCreate(attributes: $attributes) {
        appraisal {
          id
          status
          apprPriceFrom
          apprPriceTo
          dateListed
        }
        error
      }
    }
  `;

  const appraisalResult = await executeGraphQLRequest({
    endpoint: agencyUrl,
    query: createAppraisalMutation,
    variables: { attributes: appraisalData },
  }, 1);

  const { appraisal, error: appraisalError } = appraisalResult.appraisalCreate;
  assertEqual('appraisal error should be null', appraisalError, null);
  assertDefined('appraisal should exist', appraisal);
  assertDefined('appraisal.id should exist', appraisal.id);

  console.log(`  Appraisal created with id: ${appraisal.id}`);
  console.log(`    status: ${appraisal.status}`);

  // ── Step 2: List the Appraisal (promote to Sales Listing) ──
  console.log('  Promoting appraisal to sales listing...');

  const listMutation = `
    mutation salesAppraisalList($appraisalId: ID!) {
      salesAppraisalList(appraisalId: $appraisalId) {
        salesListing {
          id
          status
          dateListed
        }
        error
      }
    }
  `;

  const listResult = await executeGraphQLRequest({
    endpoint: agencyUrl,
    query: listMutation,
    variables: { appraisalId: Number(appraisal.id) },
  }, 1);

  const { salesListing: listedListing, error: listError } = listResult.salesAppraisalList;
  assertEqual('list error should be null', listError, null);
  assertDefined('salesListing should exist', listedListing);
  assertDefined('salesListing.id should exist', listedListing.id);

  console.log(`  Sales listing created with id: ${listedListing.id}`);
  console.log(`    status: ${listedListing.status}`);

  // ── Step 3: Update the Sales Listing ──
  console.log('  Updating sales listing...');

  const updateData = {
    listingTypeId: Number(listingType.id),
    salesListingDate: '2026-06-15',
    salesListingTime: '14:00',
    auctioneerId: Number(consultants[0].id),
    dateListed: '2026-03-01',
    listingSourceId: Number(source.id),
    authorityExpiryDate: '2026-09-30',
    campaignStartDate: '2026-03-15',
    advAuthorisedAmount: faker.number.int({ min: 3000, max: 10000 }),
    keysafeNo: faker.string.alphanumeric(6).toUpperCase(),
    fileRef: `REF/${faker.string.alphanumeric(4).toUpperCase()}`,
    solicitorRef: `SOL/${faker.string.alphanumeric(4).toUpperCase()}`,
    auction: true,
    passedInAuction: false,
    displayPrice: `$${faker.number.int({ min: 400000, max: 900000 }).toLocaleString()}`,
    authPriceFrom: faker.number.int({ min: 400000, max: 500000 }),
    authPriceTo: faker.number.int({ min: 600000, max: 800000 }),
    portalPrice: faker.number.int({ min: 500000, max: 700000 }),
    priceFrom: faker.number.int({ min: 450000, max: 550000 }),
    priceTo: faker.number.int({ min: 550000, max: 650000 }),
    vendorPrice: faker.number.int({ min: 500000, max: 600000 }),
    consultant1Id: Number(consultants[0].id),
    consultant2Id: consultants[1] ? Number(consultants[1].id) : undefined,
    consultant3Id: consultants[2] ? Number(consultants[2].id) : undefined,
    advConsultant1Id: Number(consultants[0].id),
    advConsultant2Id: consultants[1] ? Number(consultants[1].id) : undefined,
    advConsultant3Id: consultants[2] ? Number(consultants[2].id) : undefined,
    reportingOfficeId: Number(office.id),
    addressUndisclosed: false,
    priceUndisclosed: false,
    situationVerySensitive: false,
    hiddenFromApp: false,
    hidden: false,
    underOffer: false,
    alertmeEnabled: true,
    url: faker.internet.url(),
    virtualTourUrl: faker.internet.url(),
    videoLinkUrl: faker.internet.url(),
    interactiveFloorPlanUrl: faker.internet.url(),
    internetHits: faker.number.int({ min: 10, max: 500 }),

    websiteStatus: 'CURRENT',
    internalConjunctional: faker.lorem.sentence(),
    externalConjunctional: faker.lorem.sentence(),
    youtubeUrl: `https://youtube.com/watch?v=${faker.string.alphanumeric(11)}`,
    threeDTour: faker.internet.url(),
    vendorContactIds: contacts.map(c => Number(c.id)),
  };

  const updateMutation = `
    mutation salesListingUpdate($id: ID!, $attributes: SalesListingUpdateAttributes!) {
      salesListingUpdate(id: $id, attributes: $attributes) {
        salesListing {
          id
          status
          dateListed
          campaignStartDate
          displayPrice
          authPriceFrom
          authPriceTo
          portalPrice
          priceFrom
          priceTo
          vendorPrice
          addressUndisclosed
          priceUndisclosed
          situationVerySensitive
          hidden
          underOffer
          url
          websiteStatus
          passedInAuction
        }
        error
      }
    }
  `;

  const updateResult = await executeGraphQLRequest({
    endpoint: agencyUrl,
    query: updateMutation,
    variables: { id: Number(listedListing.id), attributes: updateData },
  }, 1);

  const { salesListing: updatedListing, error: updateError } = updateResult.salesListingUpdate;
  assertEqual('update error should be null', updateError, null);
  assertDefined('updated salesListing should exist', updatedListing);

  console.log(`  Sales listing updated: ${updatedListing.id}`);

  // Verify updated fields
  console.log('  Verifying updated listing data...');
  assertEqual('dateListed', updatedListing.dateListed, updateData.dateListed);
  assertEqual('campaignStartDate', updatedListing.campaignStartDate, updateData.campaignStartDate);
  assertEqual('displayPrice', updatedListing.displayPrice, updateData.displayPrice);
  assertEqual('authPriceFrom', updatedListing.authPriceFrom, updateData.authPriceFrom);
  assertEqual('authPriceTo', updatedListing.authPriceTo, updateData.authPriceTo);
  assertEqual('portalPrice', updatedListing.portalPrice, updateData.portalPrice);
  assertEqual('priceFrom', updatedListing.priceFrom, updateData.priceFrom);
  assertEqual('priceTo', updatedListing.priceTo, updateData.priceTo);
  assertEqual('vendorPrice', updatedListing.vendorPrice, updateData.vendorPrice);
  assertEqual('addressUndisclosed', updatedListing.addressUndisclosed, updateData.addressUndisclosed);
  assertEqual('priceUndisclosed', updatedListing.priceUndisclosed, updateData.priceUndisclosed);
  assertEqual('situationVerySensitive', updatedListing.situationVerySensitive, updateData.situationVerySensitive);
  assertEqual('hidden', updatedListing.hidden, updateData.hidden);
  assertEqual('underOffer', updatedListing.underOffer, updateData.underOffer);
  assertEqual('url', updatedListing.url, updateData.url);
  assertEqual('websiteStatus', updatedListing.websiteStatus, updateData.websiteStatus.toLowerCase());
  assertEqual('passedInAuction', updatedListing.passedInAuction, updateData.passedInAuction);
}
