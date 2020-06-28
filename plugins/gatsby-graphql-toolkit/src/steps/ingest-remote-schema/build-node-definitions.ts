import { DocumentNode } from "graphql"
import {
  IGatsbyNodeDefinition,
  RemoteTypeName,
  IRemoteId,
  IGatsbyNodeConfig,
} from "../../types"

interface IBuildNodeDefinitionArgs {
  gatsbyNodeTypes: IGatsbyNodeConfig[]
  documents: Map<RemoteTypeName, DocumentNode>
}

export function buildNodeDefinitions({
  gatsbyNodeTypes,
  documents,
}: IBuildNodeDefinitionArgs): Map<RemoteTypeName, IGatsbyNodeDefinition> {
  const definitions = new Map<RemoteTypeName, IGatsbyNodeDefinition>()

  gatsbyNodeTypes.forEach(config => {
    const document = documents.get(config.remoteTypeName)

    if (!document) {
      throw new Error(
        `Canot find GraphQL document for ${config.remoteTypeName}`
      )
    }
    definitions.set(config.remoteTypeName, {
      document,
      nodeQueryVariables: (id: IRemoteId) => ({ ...id }),
      ...config,
    })
  })
  return definitions
}
