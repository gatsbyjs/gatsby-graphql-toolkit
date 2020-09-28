import { DocumentNode, parse, print } from "graphql"
import { RemoteTypeName } from "../../types"
import { isFragment } from "../../utils/ast-predicates"

export function printQuery(
  compiledQueries: Map<RemoteTypeName, DocumentNode>,
  remoteTypeName: string
) {
  const query = compiledQueries.get(remoteTypeName)
  if (!query) {
    throw new Error(`Query for ${remoteTypeName} was not compiled`)
  }
  return print(query).replace(/\n$/, ``)
}

type FragmentName = string

export function printFragment(
  document: DocumentNode,
  fragmentName: FragmentName
) {
  const fragment = document.definitions.find(
    definition =>
      isFragment(definition) && definition.name.value === fragmentName
  )
  if (!fragment) {
    throw new Error(`Fragment ${fragmentName} was not compiled`)
  }
  return print(fragment).replace(/\n$/, ``)
}

export function dedent(gqlStrings: TemplateStringsArray) {
  return print(parse(gqlStrings[0])).replace(/\n$/, ``)
}
