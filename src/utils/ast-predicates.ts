import { BREAK, DefinitionNode, FragmentDefinitionNode, visit } from "graphql"
import * as GraphQLAST from "./ast-nodes"

export function isNonEmptyFragment(
  fragment: DefinitionNode
): fragment is FragmentDefinitionNode {
  if (!GraphQLAST.isFragment(fragment)) {
    return false
  }
  let hasFields = false
  visit(fragment, {
    Field: () => {
      hasFields = true
      return BREAK
    },
  })
  return hasFields
}
