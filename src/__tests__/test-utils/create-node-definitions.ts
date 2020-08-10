import {
  IGatsbyNodeConfig,
  IGatsbyNodeDefinition,
  IRemoteId,
  RemoteTypeName,
} from "../../types"
import { parse } from "graphql"

export function createGatsbyNodeDefinitions(
  defs: Array<Partial<IGatsbyNodeConfig>>
): Map<RemoteTypeName, IGatsbyNodeDefinition> {
  const gatsbyNodeDefs = new Map<RemoteTypeName, IGatsbyNodeDefinition>()

  defs.forEach((def, index) => {
    // TODO: Proper config validation
    if (!def.remoteTypeName) {
      throw new Error(
        `Every node type definition is expected to have key "remoteTypeName". ` +
          `But definition at index ${index} has none.`
      )
    }
    const remoteTypeName = def.remoteTypeName
    gatsbyNodeDefs.set(remoteTypeName, {
      remoteTypeName,
      document: parse(def.queries ?? ``),
      nodeQueryVariables: (id: IRemoteId) => ({ ...id }),
      ...def,
    })
  })

  return gatsbyNodeDefs
}
