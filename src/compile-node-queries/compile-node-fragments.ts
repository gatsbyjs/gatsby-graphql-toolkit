import {
  GraphQLSchema,
  DocumentNode,
  FragmentDefinitionNode,
  visit,
  TypeInfo,
  visitWithTypeInfo,
  isObjectType,
} from "graphql"
import { FragmentMap, IGatsbyNodeConfig, RemoteTypeName } from "../types"
import * as GraphQLAST from "../utils/ast-nodes"
import { replaceNodeSelectionWithReference } from "./ast-transformers/replace-node-selection-with-reference"
import { buildNodeReferenceFragmentMap } from "./analyze/build-node-reference-fragment-map"
import {
  buildTypeUsagesMap,
  TypeUsagesMap,
} from "./analyze/build-type-usages-map"

interface ICompileNodeFragmentsArgs {
  schema: GraphQLSchema
  gatsbyNodeTypes: IGatsbyNodeConfig[]
  fragments: FragmentDefinitionNode[]
}

/**
 * Compiles all user-defined custom fragments into "node fragments".
 *
 * "Node fragment" is a fragment that:
 * 1. Is defined on gatsby node type
 * 2. Is "shallow", meaning that all deep selections of other nodes
 *    are replaced with references
 *
 * For example:
 *
 * fragment Post on Post {
 *   title
 *   author {
 *     firstName
 *     email
 *   }
 * }
 * fragment User on User {
 *   lastName
 *   recentPosts {
 *     updatedAt
 *   }
 * }
 *
 * Is compiled into a map:
 * "Post": `
 * fragment Post on Post {
 *   title
 *   author {
 *     remoteTypeName: __typename
 *     remoteNodeId: id
 *   }
 * }
 * fragment User__recentPosts on Post {
 *   updatedAt
 * }
 * `,
 * "User": `
 * fragment User on User {
 *   lastName
 *   recentPosts {
 *     remoteTypeName: __typename
 *     remoteNodeId: id
 *   }
 * }
 * fragment Post__author on User {
 *   firstName
 *   email
 * }
 * `
 */
export function compileNodeFragments(
  args: ICompileNodeFragmentsArgs
): Map<RemoteTypeName, FragmentDefinitionNode[]> {
  const context: ICompileFragmentsContext = {
    schema: args.schema,
    gatsbyNodeTypes: args.gatsbyNodeTypes.reduce(
      (map, config) => map.set(config.remoteTypeName, config),
      new Map()
    ),
    nodeReferenceFragmentMap: buildNodeReferenceFragmentMap(args),
    typeUsagesMap: buildTypeUsagesMap(args),
  }
  const result = new Map<RemoteTypeName, FragmentDefinitionNode[]>()
  for (const nodeConfig of args.gatsbyNodeTypes) {
    result.set(
      nodeConfig.remoteTypeName,
      compileNormalizedNodeFragments(context, nodeConfig)
    )
  }
  return result
}

interface ICompileFragmentsContext {
  schema: GraphQLSchema
  gatsbyNodeTypes: Map<RemoteTypeName, IGatsbyNodeConfig>
  typeUsagesMap: TypeUsagesMap
  nodeReferenceFragmentMap: FragmentMap
}

function compileNormalizedNodeFragments(
  context: ICompileFragmentsContext,
  gatsbyNodeConfig: IGatsbyNodeConfig
): FragmentDefinitionNode[] {
  const { schema, typeUsagesMap } = context
  const type = schema.getType(gatsbyNodeConfig.remoteTypeName)
  if (!isObjectType(type)) {
    return []
  }
  const allTypes: string[] = [
    gatsbyNodeConfig.remoteTypeName,
    ...type.getInterfaces().map(iface => iface.name),
  ]
  const result: FragmentDefinitionNode[] = []
  for (const typeName of allTypes) {
    const typeUsages = typeUsagesMap.get(typeName) ?? []
    for (const [typeUsagePath, fields] of typeUsages) {
      result.push(
        GraphQLAST.fragmentDefinition(typeUsagePath, typeName, fields)
      )
    }
  }
  return addNodeReferences(context, gatsbyNodeConfig, result)
}

function addNodeReferences(
  context: ICompileFragmentsContext,
  gatsbyNodeConfig: IGatsbyNodeConfig,
  normalizedFragments: FragmentDefinitionNode[]
): FragmentDefinitionNode[] {
  const typeInfo = new TypeInfo(context.schema)
  const visitContext = { ...context, gatsbyNodeConfig, typeInfo }

  const doc: DocumentNode = visit(
    GraphQLAST.document(normalizedFragments),
    visitWithTypeInfo(typeInfo, replaceNodeSelectionWithReference(visitContext))
  )

  return doc.definitions.filter(GraphQLAST.isFragment)
}
