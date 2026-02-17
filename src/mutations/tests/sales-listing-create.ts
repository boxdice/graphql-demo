import { Pool } from 'pg';
import { faker } from '@faker-js/faker';
import { executeGraphQLRequest } from '../../graphql';
import {
  getAgencyUrl,
  fetchUnusedProperties,
  fetchOffice,
  fetchActiveConsultants,
  fetchContacts,
  fetchSource,
  fetchSalesListingType,
  assertEqual,
  assertDefined,
} from '../helpers';

export const name = 'SalesListingCreate';

export async function run(pool: Pool): Promise<void> {
  const agencyUrl = await getAgencyUrl();

  // Gather test data from local DB
  console.log('  Gathering test data from local DB...');
  // Use 2nd unused property — 1st may be consumed by appraisal-to-listing test
  const properties = await fetchUnusedProperties(pool, 3);
  const property = properties[1] || properties[0];
  const office = await fetchOffice(pool);
  const consultants = await fetchActiveConsultants(pool, 3);
  const contacts = await fetchContacts(pool, 2);
  const source = await fetchSource(pool);
  const listingType = await fetchSalesListingType(pool);
  console.log(`    property: ${property.id}, office: ${office.id}`);
  console.log(`    consultants: ${consultants.map(c => c.id).join(', ')}`);

  const createData = {
    // Required fields
    propertyId: String(property.id),
    officeId: String(office.id),
    consultantId: String(consultants[0].id),

    // Project
    project: false,

    // Listing details
    listingTypeId: String(listingType.id),
    salesListingDate: '2026-12-25',
    salesListingTime: '10:00',
    auctioneerId: String(consultants[0].id),
    dateListed: '2026-01-01',
    listingSourceId: String(source.id),
    authorityExpiryDate: '2026-06-30',
    campaignStartDate: '2026-01-15',
    advAuthorisedAmount: faker.number.int({ min: 3000, max: 10000 }),
    keysafeNo: faker.string.alphanumeric(6).toUpperCase(),
    fileRef: `REF/${faker.string.alphanumeric(4).toUpperCase()}`,
    solicitorRef: `SOL/${faker.string.alphanumeric(4).toUpperCase()}`,
    auction: true,
    passedInAuction: false,

    // Pricing — use integers since the API returns whole numbers
    displayPrice: `$${faker.number.int({ min: 400000, max: 900000 }).toLocaleString()}`,
    authPriceFrom: faker.number.int({ min: 400000, max: 500000 }),
    authPriceTo: faker.number.int({ min: 600000, max: 800000 }),
    portalPrice: faker.number.int({ min: 500000, max: 700000 }),
    priceFrom: faker.number.int({ min: 450000, max: 550000 }),
    priceTo: faker.number.int({ min: 550000, max: 650000 }),
    vendorPrice: faker.number.int({ min: 500000, max: 600000 }),

    // Consultants
    consultant1Id: String(consultants[0].id),
    consultant2Id: consultants[1] ? String(consultants[1].id) : undefined,
    consultant3Id: consultants[2] ? String(consultants[2].id) : undefined,
    advConsultant1Id: String(consultants[0].id),
    advConsultant2Id: consultants[1] ? String(consultants[1].id) : undefined,
    advConsultant3Id: consultants[2] ? String(consultants[2].id) : undefined,

    // Office
    reportingOfficeId: String(office.id),

    // Visibility flags
    addressUndisclosed: false,
    priceUndisclosed: false,
    situationVerySensitive: false,
    hiddenFromApp: false,
    hidden: false,
    underOffer: false,
    alertmeEnabled: true,

    // URLs
    url: faker.internet.url(),
    virtualTourUrl: faker.internet.url(),
    videoLinkUrl: faker.internet.url(),
    interactiveFloorPlanUrl: faker.internet.url(),
    youtubeUrl: `https://youtube.com/watch?v=${faker.string.alphanumeric(11)}`,
    threeDTour: faker.internet.url(),

    // Other
    internetHits: faker.number.int({ min: 10, max: 500 }),
    mediaVendorWebReference: faker.string.alphanumeric(8).toUpperCase(),

    websiteStatus: 'CURRENT',
    internalConjunctional: faker.lorem.sentence(),
    externalConjunctional: faker.lorem.sentence(),

    // Vendor contacts
    vendorContactIds: contacts.map(c => Number(c.id)),
  };

  console.log('  Creating sales listing...');
  console.log(`    propertyId: ${createData.propertyId}`);
  console.log(`    officeId: ${createData.officeId}`);
  console.log(`    consultantId: ${createData.consultantId}`);
  console.log(`    displayPrice: ${createData.displayPrice}`);

  const mutation = `
    mutation salesListingCreate($attributes: SalesListingCreateAttributes!) {
      salesListingCreate(attributes: $attributes) {
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
          internetHits
        }
        error
      }
    }
  `;

  const result = await executeGraphQLRequest({
    endpoint: agencyUrl,
    query: mutation,
    variables: { attributes: createData },
  }, 1);

  const { salesListing, error } = result.salesListingCreate;

  // Assert no error
  assertEqual('error should be null', error, null);
  assertDefined('salesListing should exist', salesListing);
  assertDefined('salesListing.id should exist', salesListing.id);

  console.log(`  Sales listing created with id: ${salesListing.id}`);
  console.log(`    status: ${salesListing.status}`);

  // Verify returned fields
  console.log('  Verifying listing data...');
  assertEqual('dateListed', salesListing.dateListed, createData.dateListed);
  assertEqual('campaignStartDate', salesListing.campaignStartDate, createData.campaignStartDate);
  assertEqual('displayPrice', salesListing.displayPrice, createData.displayPrice);
  assertEqual('authPriceFrom', salesListing.authPriceFrom, createData.authPriceFrom);
  assertEqual('authPriceTo', salesListing.authPriceTo, createData.authPriceTo);
  assertEqual('portalPrice', salesListing.portalPrice, createData.portalPrice);
  assertEqual('priceFrom', salesListing.priceFrom, createData.priceFrom);
  assertEqual('priceTo', salesListing.priceTo, createData.priceTo);
  assertEqual('vendorPrice', salesListing.vendorPrice, createData.vendorPrice);
  assertEqual('addressUndisclosed', salesListing.addressUndisclosed, createData.addressUndisclosed);
  assertEqual('priceUndisclosed', salesListing.priceUndisclosed, createData.priceUndisclosed);
  assertEqual('situationVerySensitive', salesListing.situationVerySensitive, createData.situationVerySensitive);
  assertEqual('hidden', salesListing.hidden, createData.hidden);
  assertEqual('underOffer', salesListing.underOffer, createData.underOffer);
  assertEqual('url', salesListing.url, createData.url);
  assertEqual('websiteStatus', salesListing.websiteStatus, createData.websiteStatus.toLowerCase());
  assertEqual('passedInAuction', salesListing.passedInAuction, createData.passedInAuction);
}
