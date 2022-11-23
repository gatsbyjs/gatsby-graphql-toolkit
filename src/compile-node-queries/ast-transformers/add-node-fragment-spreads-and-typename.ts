import {
  FragmentDefinitionNode,
  SelectionNode,
  ASTVisitor,
} from "graphql"
import * as GraphQLAST from "../../utils/ast-nodes"
import { isFragmentSpread } from "../../utils/ast-predicates"

export function addNodeFragmentSpreadsAndTypename(
  nodeFragments: FragmentDefinitionNode[]
): ASTVisitor {
  return {
    FragmentDefinition: () => false,
    SelectionSet: node => {
      if (node.selections.some(isFragmentSpread)) {
        return GraphQLAST.selectionSet([
          GraphQLAST.field(`__typename`),
          ...withoutTypename(node.selections),
          ...spreadAll(nodeFragments),
        ])
      }
      return undefined
    },
  }
}

function spreadAll(fragments: FragmentDefinitionNode[]) {
  return fragments.map(fragment =>
    GraphQLAST.fragmentSpread(fragment.name.value)
  )
}

function withoutTypename(selections: ReadonlyArray<SelectionNode>) {
  return selections.filter(selection => !isTypeNameField(selection))
}

function isTypeNameField(node: SelectionNode): boolean {
  return node.kind === "Field" && node.name.value === `__typename`
}
