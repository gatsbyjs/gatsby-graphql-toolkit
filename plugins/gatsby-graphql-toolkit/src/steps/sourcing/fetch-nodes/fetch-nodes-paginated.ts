import { getFirstValueByPath, findNodeFieldPath } from "./field-path-utils"
import {
  IGatsbyNodeDefinition,
  IRemoteNode,
  ISourcingContext,
} from "../../../types"
import { collectPaginateFieldOperationNames } from "./operation-utils"
import { combine, paginate, planPagination } from "./paginate"

export async function* paginatedNodeFetch(
  context: ISourcingContext,
  def: IGatsbyNodeDefinition,
  operationName: string
): AsyncGenerator<IRemoteNode> {
  const plan = planPagination(def.document, operationName)

  for await (const page of paginate(context, plan)) {
    const partialNodes = plan.strategy.getItems(page.fieldValue)

    for (const node of partialNodes) {
      yield addPaginatedFields(context, def, node)
    }
  }
}

export async function addPaginatedFields(
  context: ISourcingContext,
  def: IGatsbyNodeDefinition,
  node: IRemoteNode
): Promise<IRemoteNode> {
  const paginateFieldQueries = collectPaginateFieldOperationNames(def.document)
  const remoteId = context.idTransform.remoteNodeToId(node, def)
  const variables = def.nodeQueryVariables(remoteId)

  for (const fieldQuery of paginateFieldQueries) {
    const plan = planPagination(def.document, fieldQuery, variables)
    const pages = paginate(context, plan)
    const result = await combine(pages, plan)

    if (!result || !result.data) {
      continue
    }
    const nodeRoot = findNodeFieldPath(def.document, fieldQuery)
    const nodeData = getFirstValueByPath(result.data, nodeRoot) ?? {}
    Object.assign(node, nodeData)
  }
  return node
}
