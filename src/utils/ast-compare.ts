import { SelectionNode, SelectionSetNode } from "graphql"

export function selectionSetIncludes(
  selectionSet: SelectionSetNode | void,
  possibleSubset: SelectionSetNode | void
): boolean {
  if (selectionSet === possibleSubset) {
    return true
  }
  if (!selectionSet || !possibleSubset) {
    return false
  }
  // Perf:
  if (possibleSubset.selections.length > selectionSet.selections.length) {
    return false
  }
  return possibleSubset.selections.every(a =>
    selectionSet.selections.some(b => selectionIncludes(b, a))
  )
}

export function selectionIncludes(
  selection: SelectionNode | void,
  possibleSubset: SelectionNode | void
): boolean {
  if (selection === possibleSubset) {
    return true
  }
  if (!selection || !possibleSubset) {
    return false
  }
  if (
    selection.kind === "FragmentSpread" &&
    possibleSubset.kind === "FragmentSpread"
  ) {
    return selection.name.value === possibleSubset.name.value
  }
  if (
    selection.kind === "InlineFragment" &&
    possibleSubset.kind === "InlineFragment"
  ) {
    return (
      selection.typeCondition?.name.value ===
        possibleSubset.typeCondition?.name.value &&
      selectionSetIncludes(selection.selectionSet, possibleSubset.selectionSet)
    )
  }
  if (selection.kind === "Field" && possibleSubset.kind === "Field") {
    return (
      selection.alias?.value === possibleSubset.alias?.value &&
      selection.name.value === possibleSubset.name.value &&
      selectionSetIncludes(selection.selectionSet, possibleSubset.selectionSet)
    )
  }
  return false
}
