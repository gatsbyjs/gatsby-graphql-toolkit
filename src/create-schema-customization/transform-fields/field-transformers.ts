import {
  isObjectType,
  isAbstractType,
  isSpecifiedScalarType,
  isScalarType,
  isNonNullType,
  isListType,
  isWrappingType,
  GraphQLType,
  getNamedType,
  isEnumType,
} from "graphql"
import { resolveRemoteType } from "../utils/resolve-remote-type"
import {
  IGatsbyFieldTransform,
  IRemoteNode,
  ISchemaCustomizationContext,
} from "../../types"

// TODO: map args
// TODO: support pagination

function isListOrNonNullListType(type: any) {
  return isListType(type) || (isNonNullType(type) && isListType(type.ofType))
}

export const fieldTransformers: IGatsbyFieldTransform[] = [
  {
    // Scalars (with any wrappers, i.e. lists, non-null)
    test: ({ remoteField }) => isScalarType(getNamedType(remoteField.type)),

    transform: ({ remoteField }) => {
      const namedType = getNamedType(remoteField.type)
      const typeName = isSpecifiedScalarType(namedType)
        ? String(namedType)
        : `JSON`

      return {
        type: wrap(typeName, remoteField.type),
      }
    },
  },
  {
    // Enums (with any wrappers, i.e. lists, non-null)
    test: ({ remoteField }) => isEnumType(getNamedType(remoteField.type)),

    transform: ({ remoteField, context }) => ({
      type: toGatsbyType(context, remoteField.type),
    }),
  },
  {
    // Non-gatsby-node objects (with any wrappers, i.e. lists, non-null)
    test: ({ remoteField, context }) => {
      const namedType = getNamedType(remoteField.type)
      return (
        isObjectType(namedType) && !context.gatsbyNodeDefs.has(namedType.name)
      )
    },
    transform: ({ remoteField, context }) => ({
      type: toGatsbyType(context, remoteField.type),
    }),
  },

  {
    // Singular unions and interfaces
    test: ({ remoteField }) =>
      isAbstractType(
        isNonNullType(remoteField.type)
          ? remoteField.type.ofType
          : remoteField.type
      ),
    transform: ({ remoteField, fieldInfo, context }) => {
      return {
        type: toGatsbyType(context, remoteField.type),
        resolve: (source, _, resolverContext) => {
          const value = source[fieldInfo.gatsbyFieldName]
          return resolveNode(context, value, resolverContext) ?? value
        },
      }
    },
  },

  {
    // Lists of unions and interfaces
    test: ({ remoteField }) =>
      isListOrNonNullListType(remoteField.type) &&
      isAbstractType(getNamedType(remoteField.type)),

    transform: ({ remoteField, fieldInfo, context }) => {
      return {
        type: toGatsbyType(context, remoteField.type),
        resolve: (source, _, resolverContext) =>
          mapListOfNodes(
            context,
            source[fieldInfo.gatsbyFieldName] ?? [],
            resolverContext
          ),
      }
    },
  },

  {
    // Singular gatsby node objects (with any wrappers, i.e. list, non-null)
    test: ({ remoteField, context }) => {
      const namedType = getNamedType(remoteField.type)
      return (
        !isListOrNonNullListType(remoteField.type) &&
        isObjectType(namedType) &&
        context.gatsbyNodeDefs.has(namedType.name)
      )
    },

    transform: ({ remoteField, fieldInfo, context }) => {
      return {
        type: toGatsbyType(context, remoteField.type),
        resolve: (source, _, resolverContext) =>
          resolveNode(
            context,
            source[fieldInfo.gatsbyFieldName],
            resolverContext
          ),
      }
    },
  },

  {
    // List of gatsby nodes
    test: ({ remoteField, context }) => {
      const namedType = getNamedType(remoteField.type)
      return (
        isListOrNonNullListType(remoteField.type) &&
        isObjectType(namedType) &&
        context.gatsbyNodeDefs.has(namedType.name)
      )
    },
    transform: ({ remoteField, fieldInfo, context }) => {
      return {
        type: toGatsbyType(context, remoteField.type),
        resolve: (source, _, resolverContext) =>
          mapListOfNodes(
            context,
            source[fieldInfo.gatsbyFieldName] ?? [],
            resolverContext
          ),
      }
    },
  },

  // for finding unhandled types
  // {
  //  test: () => true,
  //  transform: ({ remoteField, fieldInfo }) => console.log(fieldInfo),
  // },
]

function toGatsbyType(
  context: ISchemaCustomizationContext,
  remoteType: GraphQLType
) {
  const namedType = getNamedType(remoteType)
  const gatsbyTypeName = context.typeNameTransform.toGatsbyTypeName(
    namedType.name
  )
  return wrap(gatsbyTypeName, remoteType)
}

/**
 * Wraps a type with the NON_NULL and LIST_OF types of the referenced remote type
 * i.e. wrapType(`JSON`, myRemoteListOfJSONType) => `[JSON]`
 */
function wrap(typeName: string, remoteType: GraphQLType): string {
  const wrappingTypes: GraphQLType[] = []
  let currentRemoteType = remoteType
  while (isWrappingType(currentRemoteType)) {
    wrappingTypes.push(currentRemoteType)
    currentRemoteType = currentRemoteType.ofType
  }

  let wrappedType = typeName
  for (const wrappingType of wrappingTypes.reverse()) {
    if (isNonNullType(wrappingType)) {
      wrappedType = `${wrappedType}!`
    }
    if (isListType(wrappingType)) {
      wrappedType = `[${wrappedType}]`
    }
  }

  return wrappedType
}

function mapListOfNodes(
  context: ISchemaCustomizationContext,
  list: unknown[],
  resolverContext: any
): any {
  return list.map(value =>
    Array.isArray(value)
      ? mapListOfNodes(context, value, resolverContext)
      : resolveNode(context, value as IRemoteNode, resolverContext) ?? value
  )
}

function resolveNode(
  context: ISchemaCustomizationContext,
  source: IRemoteNode | void | null,
  resolverContext: any
): any {
  const remoteTypeName = resolveRemoteType(context, source)
  if (!source || !remoteTypeName) {
    return
  }
  const def = context.gatsbyNodeDefs.get(remoteTypeName)
  if (!def) {
    return
  }
  const id = context.idTransform.remoteNodeToGatsbyId(source, def)
  const type = context.typeNameTransform.toGatsbyTypeName(remoteTypeName)

  return resolverContext.nodeModel.getNodeById({ id, type })
}
