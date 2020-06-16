import {
  IGatsbyFieldAliases,
  IGatsbyNodeDefinition,
  INodeIdTransform,
  IRemoteNode,
} from "../types"

export function createNodeIdTransform(
  gatsbyFieldAliases: IGatsbyFieldAliases
): INodeIdTransform {
  return {
    toGatsbyNodeId(remoteNode: IRemoteNode, def: IGatsbyNodeDefinition) {
      const idValues = def.remoteIdFields.map(idField => {
        const alias = gatsbyFieldAliases[idField] ?? idField
        if (!remoteNode[alias]) {
          throw new Error(
            `Missing field ${alias} in the remote node of type ${def.remoteTypeName}`
          )
        }
        return remoteNode[alias]
      })
      return idValues.join(`:`)
    },
  }
}
