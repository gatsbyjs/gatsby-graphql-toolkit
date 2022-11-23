import {
  TypeInfo,
  ASTVisitor,
  SelectionSetNode,
  isCompositeType,
  getNamedType,
} from "graphql"
import * as GraphQLAST from "../../utils/ast-nodes"
import { isField, isNode, isTypeNameField } from "../../utils/ast-predicates"

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
}: IAddTypeNameArgs): ASTVisitor {
  return {
    SelectionSet: (node, _, parent) => {
      const type = typeInfo.getType()
      if (
        type &&
        isNode(parent) &&
        isField(parent) &&
        !hasTypenameField(node) &&
        isCompositeType(getNamedType(type))
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
  return node.selections.some(isTypeNameField)
}
