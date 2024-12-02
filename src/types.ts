
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
  interestLevel: string;
};
