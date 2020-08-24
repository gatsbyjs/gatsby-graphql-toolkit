import {
  TypeInfo,
  Visitor,
  ASTKindToNode,
  SelectionSetNode,
  isCompositeType,
} from "graphql"
import * as GraphQLAST from "../../utils/ast-nodes"
import { isNode } from "../../utils/ast-predicates"

interface IAddTypeNameArgs {
  typeInfo: TypeInfo
}

/**
 * Adds __typename to all fields of composite types, i.e. transforms:
 * ```
 * {
 *   node { foo }
 * }
 * ```
 * to
 * ```
 * {
 *   node { __typename foo }
 * }
 * ```
 * (where `node` is of Object, Interface or Union type)
 */
export function addRemoteTypeNameField({
  typeInfo,
}: IAddTypeNameArgs): Visitor<ASTKindToNode> {
  return {
    SelectionSet: (node, _, parent) => {
      if (
        isNode(parent) &&
        parent.kind === `Field` &&
        !hasTypenameField(node) &&
        isCompositeType(typeInfo.getType())
      ) {
        return {
          ...node,
          selections: [GraphQLAST.field(`__typename`), ...node.selections],
        }
      }
      return
    },
  }
}

function hasTypenameField(node: SelectionSetNode) {
  return node.selections.some(node =>
    node.kind === "Field"
      ? node.name.value === `__typename` && !node.alias
      : false
  )
}
