import { fetchAllNodes } from "./fetch-nodes/fetch-all-nodes"
import { createNodes } from "./create-nodes/create-nodes"
import { ISourcingConfig, ISourcingContext } from "../../types"
import { formatLogMessage } from "../../utils/format-log-message"
import { createNodeIdTransform } from "../../config/node-id-transform"
import { createTypeNameTransform } from "../../config/type-name-transform"
import { defaultGatsbyFieldAliases } from "../../config/default-gatsby-field-aliases"

export async function sourceNodes(config: ISourcingConfig) {
  // Context instance passed to every nested call
  const context = createSourcingContext(config)

  const results = await fetchAllNodes(context)
  for (const result of results) {
    await createNodes(context, result)
  }
}

function createSourcingContext(config: ISourcingConfig): ISourcingContext {
  const gatsbyFieldAliases =
    config.gatsbyFieldAliases ?? defaultGatsbyFieldAliases

  const {
    gatsbyApi,
    verbose,
    idTransform = createNodeIdTransform(gatsbyFieldAliases),
    typeNameTransform = createTypeNameTransform(config.gatsbyTypePrefix),
  } = config
  const { reporter } = gatsbyApi
  const format = string => formatLogMessage(string, { verbose })

  return {
    ...config,
    gatsbyFieldAliases,
    idTransform,
    typeNameTransform,
    formatLogMessage: format,
    fetchingActivity: reporter.activityTimer(format(`fetching nodes`)),
    creatingActivity: reporter.activityTimer(format(`creating nodes`)),
  }
}
