
export type Property = {
  id: number;
  address: string;
  beds: number;
};

export type SalesListing = {
  id: number;
  propertyId: number;
  status: string;
};

export type Registration = {
  id: number;
  contactId: number;
  salesListingId: number;
  interestLevel: string;
  contact: {
    fullName: string;
  }
};

export type Comment = {
  id: number;
  comment: string;
  registrationId: number;
};
