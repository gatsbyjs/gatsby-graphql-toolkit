import {
  IGatsbyNodeDefinition,
  IRemoteNode,
  ISourcingContext,
} from "../../../types"
import { collectNodeFieldOperationNames } from "../node-definition-helpers"
import { combine, paginate, planPagination } from "./paginate"
import { findNodeFieldPath, getFirstValueByPath } from "./field-path-utils"

export async function addPaginatedFields(
  context: ISourcingContext,
  def: IGatsbyNodeDefinition,
  node: IRemoteNode
): Promise<IRemoteNode> {
  const nodeFieldQueries = collectNodeFieldOperationNames(def.document)
  const remoteId = context.idTransform.remoteNodeToId(node, def)
  const variables = def.nodeQueryVariables(remoteId)

  for (const fieldQuery of nodeFieldQueries) {
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
