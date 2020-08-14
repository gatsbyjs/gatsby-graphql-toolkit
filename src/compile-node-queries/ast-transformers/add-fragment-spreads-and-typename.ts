import {
  FragmentDefinitionNode,
  SelectionNode,
  Visitor,
  ASTKindToNode,
} from "graphql"
import * as GraphQLAST from "../../utils/ast-nodes"

export function addFragmentSpreadsAndTypename(
  fragments: FragmentDefinitionNode[]
): Visitor<ASTKindToNode> {
  return {
    FragmentDefinition: () => false, // skip fragments
    SelectionSet: node => {
      if (node.selections.some(GraphQLAST.isFragmentSpread)) {
        return GraphQLAST.selectionSet([
          GraphQLAST.field(`__typename`),
          ...withoutTypename(node.selections),
          ...spreadAll(fragments),
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
