export interface PaginatedItem {
  id: string;
}

export interface SalesListing extends PaginatedItem {
  propertyId: string;
  status: string;
}

export interface Property extends PaginatedItem {
  address: string;
  beds: number;
}

export interface Registration extends PaginatedItem {
  interestLevel: string;
  contactId: string;
  salesListingId: string;
  contact: {
    id: string;
    fullName: string;
    email: string;
    mobile: string;
  };
}

export interface PaginatedResponse<T extends PaginatedItem> {
  cursor: string;
  hasMore: boolean;
  deletedIds?: string[];
  items: T[];
}

export interface GraphQLResponse {
  salesListings: PaginatedResponse<SalesListing> & {
    properties?: PaginatedResponse<Property>;
    registrations?: PaginatedResponse<Registration>;
  };
}
