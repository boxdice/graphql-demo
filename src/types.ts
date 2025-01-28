export interface Field {
  fieldName: string;
  isScalar?: boolean;
  fieldType?: string;
}

export interface Collection {
  collectionType: string;
  itemsBaseType: string;
  fields: Field[];
}
   
export interface ItemsData {
  hasMore: boolean;
  cursor: string | null;
  items: any[];
}