import { DocumentNode, parse, print } from "graphql"
import { RemoteTypeName } from "../../types"

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

export function dedent(gqlStrings: TemplateStringsArray) {
  return print(parse(gqlStrings[0])).replace(/\n$/, ``)
}
