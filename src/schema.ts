import {
  parse,
  ObjectTypeDefinitionNode,
  TypeNode,
} from 'graphql';
import { Collection } from './types';


function unwrapType(typeNode: TypeNode): string {
  if (typeNode.kind === 'NamedType') {
    return typeNode.name.value;
  }
  if (typeNode.kind === 'NonNullType' || typeNode.kind === 'ListType') {
    return unwrapType(typeNode.type);
  }
  throw new Error(`Unsupported type node kind: ${typeNode}`);
}

export default async function fetchAndParseSchema(schemaUrl: string): Promise<Collection[]> {
  // fetch schema from URL
  const response = await fetch(schemaUrl);
  const schemaString = await response.text();
  const parsedSchema = parse(schemaString);

  // build a map of object definitions by name
  const typeMap = new Map<string, ObjectTypeDefinitionNode>();
  parsedSchema.definitions.forEach((definition) => {
    if (definition.kind === 'ObjectTypeDefinition') {
      const objDef = definition as ObjectTypeDefinitionNode;
      typeMap.set(objDef.name.value, objDef);
    }
  });

  // known built-in scalars to check for
  const builtInScalars = new Set(['String', 'ID', 'Boolean', 'Int', 'Float', 'ISO8601DateTime' ]);

  // collect an array of collection-info objects
  const collectionsData: Array<{
    collectionType: string;
    itemsBaseType: string;
    fields: Array<{ fieldName: string; fieldType: string; isScalar: boolean }>;
  }> = [];

  // Look through all ObjectTypeDefinitions
  parsedSchema.definitions.forEach((definition) => {
    if (definition.kind === 'ObjectTypeDefinition') {
      const objDef = definition as ObjectTypeDefinitionNode;
      const typeName = objDef.name.value;

      // Check if it's a "Collection" type
      if (typeName.endsWith('Collection') && objDef.fields) {
        // initialize an object to store the data about this collection
        const collectionInfo = {
          collectionType: typeName,
          itemsBaseType: '',
          fields: [] as Array<{ fieldName: string; fieldType: string; isScalar: boolean }>,
        };

        objDef.fields.forEach((field) => {
          if (field.name.value === 'items') {
            // unwrap the base type for the 'items' field
            const modelName = unwrapType(field.type);
            collectionInfo.itemsBaseType = modelName;

            // fetch the fields of that base type
            const modelDefinition = typeMap.get(modelName);
            if (modelDefinition?.fields) {
              modelDefinition.fields.forEach((modelField) => {
                const fieldTypeName = unwrapType(modelField.type);
                const isScalar = builtInScalars.has(fieldTypeName);
                collectionInfo.fields.push({
                  fieldName: modelField.name.value,
                  fieldType: fieldTypeName,
                  isScalar,
                });
              });
            }
          }
        });

        collectionsData.push(collectionInfo);
      }
    }
  });

  return collectionsData;
} 