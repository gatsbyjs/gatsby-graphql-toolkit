import { ActivityTracker, NodePluginArgs } from "gatsby"
import { ComposeFieldConfig } from "graphql-compose"
import {
  DocumentNode,
  ExecutionResult,
  GraphQLSchema,
  GraphQLField,
  GraphQLType,
  FragmentDefinitionNode,
  Source,
} from "graphql"

export type RemoteTypeName = string
export type RemoteFieldAlias = string

export interface IGatsbyFieldAliases {
  [field: string]: RemoteFieldAlias
}
export type FragmentMap = Map<RemoteTypeName, FragmentDefinitionNode>

export interface QueryVariableProviderArgs {
  queryKind: "ALL" | "ONE" | "PAGINATE_FIELD"
  document: DocumentNode
  operationName: string
  partialVariables: { [name: string]: unknown }
}

export interface QueryVariableProvider {
  (args: QueryVariableProviderArgs): { [name: string]: unknown }
}

export interface ISourcingConfig {
  gatsbyApi: NodePluginArgs
  schema: GraphQLSchema
  gatsbyNodeDefs: Map<RemoteTypeName, IGatsbyNodeDefinition>
  gatsbyTypePrefix: string
  execute: (args: {
    query: string
    operationName: string
    variables?: object
  }) => Promise<ExecutionResult>

  verbose?: boolean
  gatsbyFieldAliases?: IGatsbyFieldAliases
  idTransform?: INodeIdTransform
  typeNameTransform?: ITypeNameTransform
}

export type GraphQLSource = string | Source

export interface IGatsbyNodeConfig {
  remoteTypeName: RemoteTypeName
  remoteIdFields: string[]
  queries: GraphQLSource
}

export interface IRemoteNode {
  [key: string]: unknown
}

export interface IRemoteId {
  [remoteIdField: string]: unknown
}

export interface IFetchResult {
  remoteTypeName: string
  allNodes: IRemoteNode[]
}

export interface INodeIdTransform {
  remoteNodeToGatsbyId: (
    remoteNode: IRemoteNode,
    def: IGatsbyNodeDefinition
  ) => string
  remoteNodeToId: (
    remoteNode: IRemoteNode,
    def: IGatsbyNodeDefinition
  ) => IRemoteId
  gatsbyNodeToRemoteId: (
    gatsbyNode: Node,
    def: IGatsbyNodeDefinition
  ) => IRemoteId
  remoteIdToGatsbyNodeId: (
    remoteId: IRemoteId,
    def: IGatsbyNodeDefinition
  ) => string
}

export interface ITypeNameTransform {
  toGatsbyTypeName: (remoteTypeName: string) => string
  toRemoteTypeName: (gatsbyTypeName: string) => string
}

/**
 * Structure containing all the information required to fetch node and build schema customization for it
 */
export interface IGatsbyNodeDefinition {
  remoteTypeName: RemoteTypeName
  remoteIdFields: string[]
  document: DocumentNode
}

export interface ISourcingContext extends ISourcingConfig {
  idTransform: INodeIdTransform
  gatsbyFieldAliases: IGatsbyFieldAliases
  typeNameTransform: ITypeNameTransform
  formatLogMessage: (string) => string
  fetchingActivity: ActivityTracker
  creatingActivity: ActivityTracker
}

export interface ISchemaCustomizationContext extends ISourcingConfig {
  sourcingPlan: ISourcingPlan
  gatsbyFieldAliases: IGatsbyFieldAliases
  idTransform: INodeIdTransform
  typeNameTransform: ITypeNameTransform
}

export interface IRemoteFieldUsage {
  name: string
  alias: string
  // TODO: debugging info for easy access, like operationName, path, location in the document?
}

/**
 * Contains metadata after analyzing all of the node queries
 */
export interface ISourcingPlan {
  fetchedTypeMap: Map<RemoteTypeName, Map<RemoteFieldAlias, IRemoteFieldUsage>>
  remoteNodeTypes: Set<RemoteTypeName>
}

export interface IGatsbyFieldInfo {
  gatsbyFieldName: string
  remoteFieldName: string
  remoteFieldAlias: string
  remoteParentType: string
  gatsbyParentType: string
}

interface IGatsbyFieldTransformArgs {
  remoteField: GraphQLField<any, any>
  remoteParentType: GraphQLType
  fieldInfo: IGatsbyFieldInfo
  context: ISchemaCustomizationContext
}

export interface IGatsbyFieldTransform {
  test: (args: IGatsbyFieldTransformArgs) => boolean
  transform: (args: IGatsbyFieldTransformArgs) => ComposeFieldConfig<any, any>
}
