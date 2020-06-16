import {
  DocumentNode,
  FragmentSpreadNode,
  FragmentDefinitionNode,
  FieldNode,
  VariableNode,
  visit,
  BREAK,
} from "graphql"
import { IPaginationStrategy } from "../../../config/pagination-strategies"
import * as GraphQLAST from "../../../utils/ast-nodes"

/**
 * Given a query and an effective pagination strategy - returns field path to the first
 * paginated field
 *
 * E.g.
 *   { field { paginatedField(limit: $limit, offset: $offset) { test } } }
 * or
 *   { field { ...MyFragment }}
 *   fragment MyFragment on MyType {
 *     paginatedField(limit: $limit, offset: $offset) { test }
 *   }
 * both return
 *   ["field", "paginatedField"]
 */
export function findPaginatedFieldPath(
  document: DocumentNode,
  operationName: string,
  paginationStrategy: IPaginationStrategy<any, any>
): string[] {
  const isPaginatedField = (node: FieldNode) => {
    const variables = (node.arguments ?? [])
      .map(arg => arg.value)
      .filter((value): value is VariableNode => value.kind === "Variable")
      .map(value => value.name.value)

    return paginationStrategy.test(new Set(variables))
  }
  return findFieldPath(document, operationName, isPaginatedField)
}

/**
 * Given a query and a remote node type returns a path to the node field within the query
 */
export function findNodeFieldPath(
  document: DocumentNode,
  operationName: string
): string[] {
  // For now simply assuming the first field with a variable
  const hasVariableArgument = (node: FieldNode) =>
    (node.arguments ?? []).some(arg => arg.value.kind === "Variable")
  return findFieldPath(document, operationName, hasVariableArgument)
}

function findFieldPath(
  document: DocumentNode,
  operationName: string,
  predicate: (field: FieldNode) => boolean
) {
  const operation = document.definitions.find(
    def =>
      def.kind === "OperationDefinition" && def.name?.value === operationName
  )
  if (!operation) {
    return []
  }
  const fieldPath: string[] = []
  visit(operation, {
    Field: {
      enter: (node: FieldNode) => {
        if (fieldPath.length > 10) {
          throw new Error(
            `findFieldPath could not find matching field: reached maximum nesting level`
          )
        }
        fieldPath.push(node.name.value)
        if (predicate(node)) {
          return BREAK
        }
      },
      leave: () => {
        fieldPath.pop()
      },
    },
    FragmentSpread: (node: FragmentSpreadNode) => {
      const fragmentName = node.name.value
      const fragment = document.definitions.find(
        (f): f is FragmentDefinitionNode =>
          f.kind === "FragmentDefinition" && f.name.value === fragmentName
      )
      if (!fragment) {
        throw new Error(`Missing fragment ${fragmentName}`)
      }
      return GraphQLAST.inlineFragment(
        fragmentName,
        fragment.selectionSet.selections
      )
    },
  })

  return fieldPath
}

export function getFirstValueByPath(item: object | object[], path: string[]) {
  if (path.length === 0) {
    return item
  }
  if (Array.isArray(item)) {
    return getFirstValueByPath(item[0], path)
  }
  if (typeof item === `object` && item !== null) {
    const [key, ...nestedPath] = path
    return getFirstValueByPath(item[key], nestedPath)
  }
  return undefined
}

export function updateFirstValueByPath(
  item: object | object[],
  path: string[],
  newValue: unknown
) {
  if (path.length === 1 && typeof item === `object` && item !== null) {
    item[path[0]] = newValue
    return
  }
  if (Array.isArray(item)) {
    return updateFirstValueByPath(item[0], path, newValue)
  }
  if (typeof item === `object` && item !== null) {
    const [key, ...nestedPath] = path
    return updateFirstValueByPath(item[key], nestedPath, newValue)
  }
}
