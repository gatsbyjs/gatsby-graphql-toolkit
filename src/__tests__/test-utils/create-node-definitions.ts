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

  defs.forEach(def => {
    if (!def.remoteTypeName) {
      throw new Error("remoteTypeName must be set")
    }
    gatsbyNodeDefs.set(def.remoteTypeName, {
      remoteTypeName: def.remoteTypeName,
      remoteIdFields: [`id`],
      document: parse(def.queries ?? ``),
      nodeQueryVariables: (id: IRemoteId) => ({ ...id }),
      ...def,
    })
  })

  return gatsbyNodeDefs
}
