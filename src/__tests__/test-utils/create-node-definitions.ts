import {
  IGatsbyNodeConfig,
  IGatsbyNodeDefinition,
  IRemoteId,
  RemoteTypeName,
} from "../../types"
import { parse } from "graphql"
import { isFragment } from "../../utils/ast-nodes"

export function createGatsbyNodeDefinitions(
  defs: Array<Partial<IGatsbyNodeConfig>>
): Map<RemoteTypeName, IGatsbyNodeDefinition> {
  const gatsbyNodeDefs = new Map<RemoteTypeName, IGatsbyNodeDefinition>()

  defs.forEach((def, index) => {
    // TODO: Proper config validation
    if (!def.queries) {
      throw new Error(
        `Every node type definition is expected to have key "queries". ` +
        `But definition at index ${index} has none.`
      )
    }
    const document = parse(def.queries ?? ``)
    const fragments = document.definitions.filter(isFragment)
    if (fragments.length !== 1) {
      throw new Error(
        `Every node type query is expected to contain a single fragment `+
        `with ID fields for this node type. Definition at index ${index} has none.`
      )
    }
    const idFragment = fragments[0]
    const remoteTypeName = idFragment.typeCondition.name.value
    gatsbyNodeDefs.set(remoteTypeName, {
      remoteTypeName,
      document,
      nodeQueryVariables: (id: IRemoteId) => ({ ...id }),
      ...def,
    })
  })

  return gatsbyNodeDefs
}
