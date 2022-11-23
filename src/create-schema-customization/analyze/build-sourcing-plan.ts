import {
  FieldNode,
  GraphQLSchema,
  TypeInfo,
  visit,
  visitWithTypeInfo,
  visitInParallel,
  ASTVisitor,
  getNamedType,
  isUnionType,
  isEnumType,
} from "graphql"
import {
  IGatsbyNodeDefinition,
  IRemoteFieldUsage,
  ISourcingPlan,
  RemoteFieldAlias,
  RemoteTypeName,
} from "../../types"

interface IBuildSourcingPlanArgs {
  schema: GraphQLSchema
  gatsbyNodeDefs: Map<RemoteTypeName, IGatsbyNodeDefinition>
}

export function buildSourcingPlan(args: IBuildSourcingPlanArgs): ISourcingPlan {
  return {
    fetchedTypeMap: buildFetchedTypeMap(args),
    remoteNodeTypes: new Set(args.gatsbyNodeDefs.keys()),
  }
}

function buildFetchedTypeMap(args: IBuildSourcingPlanArgs) {
  const schema = args.schema
  const fetchedTypesMap: ISourcingPlan["fetchedTypeMap"] = new Map()
  const typeInfo = new TypeInfo(schema)

  const Visitors: {
    collectTypeFields: ASTVisitor
    addUnionTypes: ASTVisitor
    addEnumTypes: ASTVisitor
  } = {
    collectTypeFields: {
      Field: (node: FieldNode) => {
        const parentTypeName = typeInfo.getParentType()?.name ?? ``
        if (
          parentTypeName === schema.getQueryType()?.name ||
          parentTypeName === schema.getMutationType()?.name
        ) {
          return
        }
        const aliasNode = node.alias ?? node.name

        if (!fetchedTypesMap.has(parentTypeName)) {
          fetchedTypesMap.set(parentTypeName, new Map())
        }
        const fetchedFields = fetchedTypesMap.get(parentTypeName) as Map<
          RemoteFieldAlias,
          IRemoteFieldUsage
        >
        fetchedFields.set(aliasNode.value, {
          alias: aliasNode.value,
          name: node.name.value,
        })
      },
    },
    addUnionTypes: {
      Field: () => {
        // Union types must be added separately because they don't have fields
        //  by themselves and as such won't be added by `collectTypeFields`
        const type = typeInfo.getType()
        if (!type) {
          return
        }
        const unionType = getNamedType(type)
        if (!isUnionType(unionType)) {
          return
        }
        if (!fetchedTypesMap.has(unionType.name)) {
          fetchedTypesMap.set(unionType.name, new Map())
        }
      },
    },
    addEnumTypes: {
      Field: () => {
        // Enum types must be added separately as well
        const type = typeInfo.getType()
        if (!type) {
          return
        }
        const enumType = getNamedType(type)
        if (!isEnumType(enumType)) {
          return
        }
        if (!fetchedTypesMap.has(enumType.name)) {
          fetchedTypesMap.set(enumType.name, new Map())
        }
      },
    },
  }

  const visitor = visitWithTypeInfo(
    typeInfo,
    visitInParallel([
      Visitors.collectTypeFields,
      Visitors.addUnionTypes,
      Visitors.addEnumTypes,
    ])
  )

  for (const [, def] of args.gatsbyNodeDefs) {
    // TODO: optimize visitorKeys
    visit(def.document, visitor)
  }

  return fetchedTypesMap
}
