import { print } from "graphql"
import {
  IFetchResult,
  IGatsbyNodeDefinition,
  IRemoteId,
  IRemoteNode,
  ISourcingContext,
  RemoteTypeName,
} from "../../../types"
import { collectNodeOperationNames } from "./operation-utils"
import { findNodeFieldPath, getFirstValueByPath } from "./field-path-utils"
import { addPaginatedFields } from "./fetch-nodes-paginated"

export async function fetchByIds(
  context: ISourcingContext,
  nodes: { remoteTypeName: string; remoteId: IRemoteId }[]
): Promise<IFetchResult[]> {
  const idsByType = new Map<RemoteTypeName, IRemoteId[]>()

  for (const nodeInfo of nodes) {
    const ids = idsByType.get(nodeInfo.remoteTypeName) ?? []
    ids.push(nodeInfo.remoteId)
    idsByType.set(nodeInfo.remoteTypeName, ids)
  }

  const result: IFetchResult[] = []
  for (const [remoteTypeName, ids] of idsByType) {
    const def = context.gatsbyNodeDefs.get(remoteTypeName)
    if (!def) {
      throw new Error(
        `Could not get Gatsby node definition for type ${remoteTypeName}`
      )
    }
    result.push(await fetchNodesByType(context, def, ids))
  }
  return result
}

async function fetchNodesByType(
  context: ISourcingContext,
  def: IGatsbyNodeDefinition,
  ids: IRemoteId[]
): Promise<IFetchResult> {
  const { gatsbyApi, formatLogMessage } = context
  const { reporter } = gatsbyApi

  const operationName = collectNodeOperationNames(def.document)[0]
  if (!operationName) {
    throw new Error(
      `Could not find node re-fetching operation for ${def.remoteTypeName}`
    )
  }
  const activity = reporter.activityTimer(
    formatLogMessage(`fetching ${def.remoteTypeName}`)
  )
  activity.start()
  const query = print(def.document)
  const nodeFieldPath = findNodeFieldPath(def.document, operationName)

  try {
    // TODO: batch this
    const allNodes: IRemoteNode[] = []

    for (const id of ids) {
      const result = await context.execute({
        query,
        operationName,
        document: def.document,
        variables: def.nodeQueryVariables(id),
      })
      if (!result.data) {
        const message = result.errors?.length
          ? result.errors[0].message
          : `Could not execute ${operationName} query for ${def.remoteTypeName} node type`
        throw new Error(message)
      }
      const node = getFirstValueByPath(result.data, nodeFieldPath)
      await addPaginatedFields(context, def, node as IRemoteNode)
      allNodes.push(node)
    }

    return {
      remoteTypeName: def.remoteTypeName,
      allNodes,
    }
  } finally {
    activity.end()
  }
}
