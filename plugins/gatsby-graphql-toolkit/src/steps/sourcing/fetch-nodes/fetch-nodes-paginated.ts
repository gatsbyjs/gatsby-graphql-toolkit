import { print, OperationDefinitionNode } from "graphql"
import {
  getFirstValueByPath,
  findPaginatedFieldPath,
  updateFirstValueByPath,
  findNodeFieldPath,
} from "./field-path-utils"
import {
  IGatsbyNodeDefinition,
  IRemoteNode,
  ISourcingContext,
} from "../../../types"
import {
  IPaginationStrategy,
  PaginationStrategies,
} from "../../../config/pagination-strategies"
import { collectPaginateFieldOperationNames } from "./operation-utils"

export async function paginatedNodeFetch(
  context: ISourcingContext,
  def: IGatsbyNodeDefinition,
  operationName: string
): Promise<IRemoteNode[]> {
  const { data, pager, fieldPath } = await paginate(context, def, operationName)
  const partialNodes = pager.getItems(getFirstValueByPath(data, fieldPath))

  const fullNodes: IRemoteNode[] = []
  for (const node of partialNodes) {
    // TODO: paginate fields concurrently
    // TODO: batch those queries using batching dataloader from gatsby-source-graphql
    fullNodes.push(await addPaginatedFields(context, def, node as IRemoteNode))
  }
  return fullNodes
}

export async function addPaginatedFields(
  context: ISourcingContext,
  def: IGatsbyNodeDefinition,
  node: IRemoteNode
): Promise<IRemoteNode> {
  const paginateFieldsOperations = collectPaginateFieldOperationNames(
    def.document
  )
  const remoteId = context.idTransform.remoteNodeToId(node, def)
  for (const paginateFieldOperation of paginateFieldsOperations) {
    const { data } = await paginate(
      context,
      def,
      paginateFieldOperation,
      def.nodeQueryVariables(remoteId)
    )
    const fieldPath = findNodeFieldPath(def.document, paginateFieldOperation)
    const paginatedFieldData = getFirstValueByPath(data, fieldPath)
    Object.assign(node, paginatedFieldData)
  }
  return node
}

interface IPaginationResult {
  data: object
  fieldPath: string[]
  pager: IPaginationStrategy<any, any>
}

async function paginate(
  context: ISourcingContext,
  def: IGatsbyNodeDefinition,
  operationName: string,
  variables: object = {}
): Promise<IPaginationResult> {
  const document = def.document
  const queryNode = document.definitions.find(
    (d): d is OperationDefinitionNode =>
      d.kind === "OperationDefinition" && d.name?.value === operationName
  )
  if (!queryNode) {
    throw new Error(
      `Operation name ${operationName} not found for node type ${def.remoteTypeName}`
    )
  }
  const variableNames =
    queryNode.variableDefinitions?.map(
      variable => variable.variable.name.value
    ) ?? []
  const variableSet = new Set(variableNames)
  const pager = PaginationStrategies.find(s => s.test(variableSet))

  if (!pager) {
    throw new Error(
      `Could not resolve pagination strategy for the following variables:\n` +
        variableNames.join(`, `)
    )
  }

  const query = print(document)
  const fieldPath = findPaginatedFieldPath(document, operationName, pager)

  // FIXME
  let state: any = pager.start()
  let result

  while (state.hasNextPage) {
    result = await context.execute({
      operationName,
      query,
      variables: { ...variables, ...state.variables },
      document,
    })
    if (!result.data) {
      const message = result.errors?.length
        ? result.errors[0].message
        : `Could not execute ${operationName} query for ${def.remoteTypeName} node type`
      throw new Error(message)
    }
    const page = getFirstValueByPath(result.data, fieldPath)
    state = pager.addPage(state, page)
  }
  // Put combined result under the same field of the last result
  updateFirstValueByPath(result.data, fieldPath, state.result)

  return {
    data: result.data,
    fieldPath,
    pager,
  }
}
