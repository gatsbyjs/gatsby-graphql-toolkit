import { fetchAllNodes } from "./fetch-nodes/fetch-all-nodes"
import { createNodes } from "./node-actions/create-nodes"
import { deleteNodes } from "./node-actions/delete-nodes"
import { touchNodes } from "./node-actions/touch-nodes"
import { fetchByIds } from "./fetch-nodes/fetch-nodes-by-id"
import {
  INodeDeleteEvent,
  INodeUpdateEvent,
  ISourceChanges,
  ISourcingConfig,
  ISourcingContext,
} from "../../types"
import { formatLogMessage } from "../../utils/format-log-message"
import { createNodeIdTransform } from "../../config/node-id-transform"
import { createTypeNameTransform } from "../../config/type-name-transform"
import { defaultGatsbyFieldAliases } from "../../config/default-gatsby-field-aliases"

export async function sourceAllNodes(config: ISourcingConfig) {
  // Context instance passed to every nested call
  const context = createSourcingContext(config)

  for await (const result of fetchAllNodes(context)) {
    await createNodes(context, result)
  }
}

export async function sourceNodeChanges(
  config: ISourcingConfig,
  delta: ISourceChanges
) {
  const updates: INodeUpdateEvent[] = []
  const deletes: INodeDeleteEvent[] = []

  delta.nodeEvents.forEach(event => {
    if (event.eventName === "UPDATE") {
      updates.push(event)
    }
    if (event.eventName === "DELETE") {
      deletes.push(event)
    }
  })

  const context = createSourcingContext(config)
  await touchNodes(context)

  for await (const result of fetchByIds(context, updates)) {
    await createNodes(context, result)
  }
  await deleteNodes(context, deletes)
}

function createSourcingContext(config: ISourcingConfig): ISourcingContext {
  const gatsbyFieldAliases =
    config.gatsbyFieldAliases ?? defaultGatsbyFieldAliases

  const {
    gatsbyApi,
    verbose,
    idTransform = createNodeIdTransform(gatsbyFieldAliases),
    typeNameTransform = createTypeNameTransform(config.gatsbyTypePrefix),
    queryConcurrency = Number(process.env.GATSBY_CONCURRENT_DOWNLOAD) || 50,
  } = config
  const { reporter } = gatsbyApi
  const format = string => formatLogMessage(string, { verbose })

  return {
    ...config,
    queryConcurrency,
    gatsbyFieldAliases,
    idTransform,
    typeNameTransform,
    formatLogMessage: format,
    fetchingActivity: reporter.activityTimer(format(`fetching nodes`)),
    creatingActivity: reporter.activityTimer(format(`creating nodes`)),
  }
}
