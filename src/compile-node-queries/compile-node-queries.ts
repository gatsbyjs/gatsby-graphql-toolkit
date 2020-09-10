import {
  DocumentNode,
  FragmentDefinitionNode,
  GraphQLSchema,
  parse,
  TypeInfo,
  visit,
  visitWithTypeInfo,
} from "graphql"
import { flatMap } from "lodash"
import { defaultGatsbyFieldAliases } from "../config/default-gatsby-field-aliases"
import { addVariableDefinitions } from "./ast-transformers/add-variable-definitions"
import { aliasGatsbyNodeFields } from "./ast-transformers/alias-gatsby-node-fields"
import { addNodeFragmentSpreadsAndTypename } from "./ast-transformers/add-node-fragment-spreads-and-typename"
import { removeUnusedFragments } from "./ast-transformers/remove-unused-fragments"
import {
  compileNodeFragments,
  compileNonNodeFragments,
} from "./compile-fragments"
import {
  GraphQLSource,
  ICompileQueriesContext,
  IGatsbyFieldAliases,
  IGatsbyNodeConfig,
  RemoteTypeName,
} from "../types"
import { isFragment } from "../utils/ast-predicates"
import { promptUpgradeIfRequired } from "../utils/upgrade-prompt"
import { buildNodeReferenceFragmentMap } from "./analyze/build-node-reference-fragment-map"
import { buildTypeUsagesMap } from "./analyze/build-type-usages-map"
import { selectionSetIncludes } from "../utils/ast-compare"
import { addRemoteTypeNameField } from "./ast-transformers/add-remote-typename-field"

interface ICompileNodeQueriesArgs {
  schema: GraphQLSchema
  gatsbyNodeTypes: IGatsbyNodeConfig[]
  gatsbyFieldAliases?: IGatsbyFieldAliases
  customFragments:
    | Array<GraphQLSource | string>
    | Map<RemoteTypeName, GraphQLSource | string>
}

/**
 * Combines `queries` from node types config with any user-defined
 * fragments and produces final queries used for node sourcing.
 */
export function compileNodeQueries(
  args: ICompileNodeQueriesArgs
): Map<RemoteTypeName, DocumentNode> {
  promptUpgradeIfRequired(args.gatsbyNodeTypes)
  const context = createCompilationContext(args)
  const nodeFragmentMap = compileNodeFragments(context)

  // Node fragments may still spread non-node fragments
  // For example:
  //
  // fragment User on User {
  //   dateOfBirth { ...UtcTime }
  // }
  //
  // In this case the document must also contain this UtcTime fragment:
  // fragment UtcTime on DateTime {
  //   utcTime
  // }
  //
  // So we add all non node fragments to all documents, but then
  // filtering out unused fragments
  const allNonNodeFragments = compileNonNodeFragments(context)

  const documents = new Map<RemoteTypeName, DocumentNode>()
  args.gatsbyNodeTypes.forEach(config => {
    const def = compileDocument(context, {
      remoteTypeName: config.remoteTypeName,
      nodeFragments: nodeFragmentMap.get(config.remoteTypeName) ?? [],
      nonNodeFragments: allNonNodeFragments,
    })
    documents.set(config.remoteTypeName, def)
  })

  return documents
}

interface ICompileDocumentArgs {
  remoteTypeName: RemoteTypeName
  nodeFragments: FragmentDefinitionNode[]
  nonNodeFragments: FragmentDefinitionNode[]
}

function compileDocument(
  context: ICompileQueriesContext,
  { remoteTypeName, nodeFragments, nonNodeFragments }: ICompileDocumentArgs
) {
  const queries = context.originalConfigQueries.get(remoteTypeName)

  if (!queries) {
    throw new Error(
      `Could not find config queries for type "${remoteTypeName}"`
    )
  }

  const fullDocument: DocumentNode = {
    ...queries,
    definitions: [
      ...queries.definitions,
      ...nodeFragments,
      ...nonNodeFragments,
    ],
  }

  // Expected query variants:
  //  1. { allUser { ...IDFragment } }
  //  2. { allNode(type: "User") { ...IDFragment } }
  //
  // We want to transform them to:
  //  1. { allUser { ...IDFragment ...UserFragment1 ...UserFragment2 }}
  //  2. { allNode(type: "User") { ...IDFragment ...UserFragment1 ...UserFragment2 }}
  const typeInfo = new TypeInfo(context.schema)

  // TODO: optimize visitor keys
  let doc: DocumentNode = visit(
    fullDocument,
    addNodeFragmentSpreadsAndTypename(nodeFragments)
  )
  doc = visit(
    doc,
    visitWithTypeInfo(typeInfo, addRemoteTypeNameField({ typeInfo }))
  )
  doc = visit(
    doc,
    visitWithTypeInfo(typeInfo, aliasGatsbyNodeFields({ ...context, typeInfo }))
  )
  doc = visit(
    doc,
    visitWithTypeInfo(typeInfo, addVariableDefinitions({ typeInfo }))
  )
  doc = visit(doc, removeUnusedFragments())

  // Prettify:
  return removeIdFragmentDuplicates(remoteTypeName, doc)
}

function removeIdFragmentDuplicates(
  remoteTypeName: RemoteTypeName,
  doc: DocumentNode
): DocumentNode {
  // Assume ID fragment is listed first
  const idFragment = doc.definitions.find(isFragment)

  if (!idFragment) {
    throw new Error(
      `Missing ID Fragment in type config for "${remoteTypeName}"`
    )
  }
  const duplicates = doc.definitions
    .filter(
      (def): def is FragmentDefinitionNode =>
        isFragment(def) &&
        def !== idFragment &&
        selectionSetIncludes(idFragment.selectionSet, def.selectionSet)
    )
    .map(def => def.name.value)

  const duplicatesSet = new Set<string>(duplicates)

  if (duplicatesSet.size === 0) {
    return doc
  }

  return visit(doc, {
    FragmentSpread: node => {
      if (duplicatesSet.has(node.name.value)) {
        // Delete this node
        return null
      }
      return undefined
    },
    FragmentDefinition: node => {
      if (duplicatesSet.has(node.name.value)) {
        // Delete this node
        return null
      }
      // Stop visiting this node
      return false
    },
  })
}

function createCompilationContext(
  args: ICompileNodeQueriesArgs
): ICompileQueriesContext {
  const allFragmentDocs: DocumentNode[] = []
  args.customFragments.forEach(fragmentString => {
    allFragmentDocs.push(parse(fragmentString))
  })
  const fragments = flatMap(allFragmentDocs, doc =>
    doc.definitions.filter(isFragment)
  )
  return {
    schema: args.schema,
    nodeReferenceFragmentMap: buildNodeReferenceFragmentMap(args),
    typeUsagesMap: buildTypeUsagesMap({ ...args, fragments }),
    gatsbyNodeTypes: args.gatsbyNodeTypes.reduce(
      (map, config) => map.set(config.remoteTypeName, config),
      new Map()
    ),
    originalConfigQueries: args.gatsbyNodeTypes.reduce(
      (map, config) => map.set(config.remoteTypeName, parse(config.queries)),
      new Map()
    ),
    originalCustomFragments: fragments,
    gatsbyFieldAliases: args.gatsbyFieldAliases ?? defaultGatsbyFieldAliases,
  }
}
