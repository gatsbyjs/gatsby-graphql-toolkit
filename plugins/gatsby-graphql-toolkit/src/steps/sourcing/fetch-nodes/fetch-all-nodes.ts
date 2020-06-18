import {
  IGatsbyNodeDefinition,
  IFetchResult,
  ISourcingContext,
  IRemoteNode,
} from "../../../types"
import { paginatedNodeFetch } from "./fetch-nodes-paginated"
import { collectListOperationNames } from "./operation-utils"
import { runConcurrently } from "../../../utils/run-concurrently"

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
    const queryThunks = [...gatsbyNodeDefs.values()].map(def => () =>
      fetchNodesByType(context, def)
    )
    return runConcurrently(queryThunks, context.queryConcurrency)
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
    // TODO: async generator for allNodes and paginatedNodeFetch too?
    const allNodes: IRemoteNode[] = []
    const listOperations = collectListOperationNames(nodeDefinition.document)
    for (const nodeListQuery of listOperations) {
      const chunk = await paginatedNodeFetch(
        context,
        nodeDefinition,
        nodeListQuery
      )
      allNodes.push(...chunk)
    }
    return {
      remoteTypeName: nodeDefinition.remoteTypeName,
      allNodes,
    }
  } finally {
    activity.end()
  }
}
