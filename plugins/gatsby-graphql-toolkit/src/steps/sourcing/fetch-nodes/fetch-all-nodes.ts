import {
  IGatsbyNodeDefinition,
  IFetchResult,
  ISourcingContext,
  IRemoteNode,
} from "../../../types"
import { paginatedNodeFetch } from "./fetch-nodes-paginated"
import { collectListOperationNames } from "./operation-utils"

/**
 * fetches nodes from the remote GraphQL server
 *
 * @returns {Array}
 */
export async function* fetchAllNodes(
  context: ISourcingContext
): AsyncGenerator<IFetchResult> {
  const { fetchingActivity, gatsbyNodeDefs } = context
  fetchingActivity.start()
  try {
    const promises: Promise<IFetchResult>[] = []
    for (const def of gatsbyNodeDefs.values()) {
      promises.push(fetchNodesByType(context, def))
    }
    for (const result of promises) {
      yield result
    }
  } finally {
    fetchingActivity.end()
  }
}

/**
 * Fetches and paginates remote nodes by type while reporting progress
 */
async function fetchNodesByType(
  context: ISourcingContext,
  nodeDefinition: IGatsbyNodeDefinition
): Promise<IFetchResult> {
  const { gatsbyApi, formatLogMessage } = context
  const { reporter } = gatsbyApi
  const activity = reporter.activityTimer(
    formatLogMessage(`fetching ${nodeDefinition.remoteTypeName}`)
  )
  activity.start()

  try {
    const allNodes: IRemoteNode[] = []
    const listOperations = collectListOperationNames(nodeDefinition.document)
    for (const nodeListQuery of listOperations) {
      const nodes = paginatedNodeFetch(context, nodeDefinition, nodeListQuery)
      for await (const node of nodes) {
        allNodes.push(node)
      }
    }
    return {
      remoteTypeName: nodeDefinition.remoteTypeName,
      allNodes,
    }
  } finally {
    activity.end()
  }
}
