import {
  DocumentNode,
  FragmentDefinitionNode,
  GraphQLSchema,
  isObjectType,
  TypeInfo,
  visit,
  visitWithTypeInfo,
} from "graphql"
import { FragmentMap, IGatsbyNodeConfig, RemoteTypeName } from "../types"
import * as GraphQLAST from "../utils/ast-nodes"
import { replaceNodeSelectionWithReference } from "./ast-transformers/replace-node-selection-with-reference"
import { buildNodeReferenceFragmentMap } from "./analyze/build-node-reference-fragment-map"
import {
  buildTypeUsagesMap,
  TypeUsagesMap,
} from "./analyze/build-type-usages-map"
import { isFragment } from "../utils/ast-predicates"

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
  const nodeFragments = new Map<RemoteTypeName, FragmentDefinitionNode[]>()
  for (const nodeConfig of context.gatsbyNodeTypes.values()) {
    nodeFragments.set(
      nodeConfig.remoteTypeName,
      compileNormalizedNodeFragments(context, nodeConfig)
    )
  }
  return nodeFragments
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
  return addNodeReferences(
    context.schema,
    context.nodeReferenceFragmentMap,
    result
  )
}

interface ICompileNonNodeFragmentsArgs {
  schema: GraphQLSchema
  gatsbyNodeTypes: IGatsbyNodeConfig[]
  fragments: FragmentDefinitionNode[]
}

export function compileNonNodeFragments(args: ICompileNonNodeFragmentsArgs) {
  const nonNodeFragments = findAllNonNodeFragments(args)
  return addNodeReferences(
    args.schema,
    buildNodeReferenceFragmentMap(args),
    nonNodeFragments
  )
}

function addNodeReferences(
  schema: GraphQLSchema,
  nodeReferenceFragmentMap: FragmentMap,
  fragments: FragmentDefinitionNode[]
): FragmentDefinitionNode[] {
  const typeInfo = new TypeInfo(schema)

  const visitContext = {
    schema,
    nodeReferenceFragmentMap,
    typeInfo,
  }
  let doc: DocumentNode = visit(
    GraphQLAST.document(fragments),
    visitWithTypeInfo(typeInfo, replaceNodeSelectionWithReference(visitContext))
  )
  return doc.definitions.filter(isFragment)
}

function findAllNonNodeFragments(
  args: ICompileNonNodeFragmentsArgs
): FragmentDefinitionNode[] {
  const nodeTypes = new Set()
  args.gatsbyNodeTypes.forEach(def => {
    const type = args.schema.getType(def.remoteTypeName)
    if (!isObjectType(type)) {
      return
    }
    nodeTypes.add(type.name)
    type.getInterfaces().forEach(iface => {
      nodeTypes.add(iface.name)
    })
  })

  return args.fragments.filter(
    fragment => !nodeTypes.has(fragment.typeCondition.name.value)
  )
}
