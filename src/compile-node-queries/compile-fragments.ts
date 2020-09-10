import {
  DocumentNode,
  FragmentDefinitionNode,
  GraphQLSchema,
  isObjectType,
  TypeInfo,
  visit,
  visitWithTypeInfo,
} from "graphql"
import {
  FragmentMap,
  ICompileQueriesContext,
  IGatsbyNodeConfig,
  RemoteTypeName,
} from "../types"
import * as GraphQLAST from "../utils/ast-nodes"
import { replaceNodeSelectionWithReference } from "./ast-transformers/replace-node-selection-with-reference"
import { isFragment } from "../utils/ast-predicates"

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
  context: ICompileQueriesContext
): Map<RemoteTypeName, FragmentDefinitionNode[]> {
  const nodeFragments = new Map<RemoteTypeName, FragmentDefinitionNode[]>()
  for (const nodeConfig of context.gatsbyNodeTypes.values()) {
    nodeFragments.set(
      nodeConfig.remoteTypeName,
      compileNormalizedNodeFragments(context, nodeConfig)
    )
  }
  return nodeFragments
}

function compileNormalizedNodeFragments(
  context: ICompileQueriesContext,
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

export function compileNonNodeFragments(context: ICompileQueriesContext) {
  const nonNodeFragments = findAllNonNodeFragments(context)
  return addNodeReferences(
    context.schema,
    context.nodeReferenceFragmentMap,
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
  args: ICompileQueriesContext
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

  return args.originalCustomFragments.filter(
    fragment => !nodeTypes.has(fragment.typeCondition.name.value)
  )
}
