import {
  FieldNode,
  Visitor,
  TypeInfo,
  ASTKindToNode,
  GraphQLSchema,
  GraphQLCompositeType,
  isObjectType,
  isUnionType,
} from "graphql"
import { IGatsbyFieldAliases, IGatsbyNodeConfig } from "../../types"
import * as GraphQLAST from "../../utils/ast-nodes"

interface IAliasGatsbyNodeFieldsArgs {
  gatsbyNodeTypes: Array<IGatsbyNodeConfig>
  gatsbyFieldAliases: IGatsbyFieldAliases
  typeInfo: TypeInfo
  schema: GraphQLSchema
}

export function aliasGatsbyNodeFields(
  args: IAliasGatsbyNodeFieldsArgs
): Visitor<ASTKindToNode> {
  return {
    Field: (node: FieldNode) => {
      const type = args.typeInfo.getParentType()

      if (type && isNodeType(type, args)) {
        return aliasField(node, args.gatsbyFieldAliases)
      }
      return undefined
    },
  }
}

export function isNodeType(
  type: GraphQLCompositeType,
  args: IAliasGatsbyNodeFieldsArgs
): boolean {
  if (isUnionType(type)) {
    return false
  }
  if (isObjectType(type)) {
    return args.gatsbyNodeTypes.some(t => t.remoteTypeName === type.name)
  }
  // Interface type
  const possibleTypes = args.schema.getPossibleTypes(type)
  return possibleTypes.some(possibleType => isNodeType(possibleType, args))
}

export function aliasField(
  node: FieldNode,
  map: IGatsbyFieldAliases
): FieldNode | void {
  if (!map[node.name.value]) {
    return
  }
  const alias = map[node.name.value]
  const newFieldNode: FieldNode = {
    ...node,
    alias: GraphQLAST.name(alias),
  }
  return newFieldNode
}
