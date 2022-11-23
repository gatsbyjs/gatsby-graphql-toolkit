import { ASTVisitor } from "graphql"
import * as GraphQLAST from "../../utils/ast-nodes"
import { isFragment, isOperation } from "../../utils/ast-predicates"

type FragmentName = string

export function removeUnusedFragments(): ASTVisitor {
  let currentSpreads: Array<FragmentName> = []
  const definitionSpreads: Map<string, Array<FragmentName>> = new Map()

  return {
    FragmentSpread: {
      enter: node => {
        currentSpreads.push(node.name.value)
      },
    },
    OperationDefinition: {
      leave: node => {
        if (!node.name?.value) {
          throw new Error("Every query must have a name")
        }
        definitionSpreads.set(node.name.value, currentSpreads)
        currentSpreads = []
      },
    },
    FragmentDefinition: {
      leave: node => {
        definitionSpreads.set(node.name.value, currentSpreads)
        currentSpreads = []
      },
    },
    Document: {
      leave: node => {
        const operations = node.definitions.filter(isOperation)
        const operationNames = operations.map(op => op.name?.value)

        const usedSpreads = new Set(
          operationNames.reduce(collectSpreadsRecursively, [])
        )
        const usedFragments = node.definitions.filter(
          node => isFragment(node) && usedSpreads.has(node.name.value)
        )
        return GraphQLAST.document([...operations, ...usedFragments])
      },
    },
  }

  function collectSpreadsRecursively(
    acc: Array<FragmentName>,
    definitionName: string | void
  ) {
    if (!definitionName) {
      return acc
    }
    const spreads = definitionSpreads.get(definitionName) ?? []
    return spreads.length === 0
      ? acc
      : spreads.reduce(collectSpreadsRecursively, acc.concat(spreads))
  }
}
