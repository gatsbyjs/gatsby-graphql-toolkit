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
      if (isTypeName(node) || isNodeType(args.typeInfo.getParentType(), args)) {
        return aliasField(node, args.gatsbyFieldAliases)
      }
      return undefined
    },
  }
}

function isTypeName(node: FieldNode) {
  return (
    node.name.value === `__typename` &&
    (!node.alias || node.alias.value === `__typename`)
  )
}

export function isNodeType(
  type: GraphQLCompositeType | null | void,
  args: IAliasGatsbyNodeFieldsArgs
): boolean {
  if (!type) {
    return false
  }
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
