import { SelectionSetNode, ASTVisitor } from "graphql"

/**
 * Strip unnecessary wrapping (just a prettify)
 * i.e. { ...on InterfaceType { ...on ObjectType1 ...on ObjectType2 } }
 *   -> { ...on ObjectType1 ...on ObjectType2 }
 */
export function stripWrappingFragments(): ASTVisitor {
  return {
    SelectionSet: {
      leave: (node: SelectionSetNode) => {
        if (
          node.selections.length !== 1 ||
          node.selections[0].kind !== "InlineFragment"
        ) {
          return
        }
        const inlineFragment = node.selections[0]
        const isWrapper = inlineFragment.selectionSet.selections.every(
          selection =>
            selection.kind === "FragmentSpread" ||
            selection.kind === "InlineFragment"
        )
        return isWrapper ? inlineFragment.selectionSet : undefined
      },
    },
  }
}
