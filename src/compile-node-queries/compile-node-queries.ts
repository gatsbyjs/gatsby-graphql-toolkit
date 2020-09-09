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
  IGatsbyFieldAliases,
  IGatsbyNodeConfig,
  RemoteTypeName,
} from "../types"
import { selectionSetIncludes } from "../utils/ast-compare"
import { isFragment } from "../utils/ast-predicates"
import { promptUpgradeIfRequired } from "../utils/upgrade-prompt"
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
export function compileNodeQueries({
  schema,
  gatsbyNodeTypes,
  gatsbyFieldAliases = defaultGatsbyFieldAliases,
  customFragments,
}: ICompileNodeQueriesArgs): Map<RemoteTypeName, DocumentNode> {
  promptUpgradeIfRequired(gatsbyNodeTypes)

  const documents = new Map<RemoteTypeName, DocumentNode>()
  const allFragmentDocs: DocumentNode[] = []
  customFragments.forEach(fragmentString => {
    allFragmentDocs.push(parse(fragmentString))
  })
  const fragments = flatMap(allFragmentDocs, doc =>
    doc.definitions.filter(isFragment)
  )

  const nodeFragmentMap = compileNodeFragments({
    schema,
    gatsbyNodeTypes,
    fragments,
  })

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
  const allNonNodeFragments = compileNonNodeFragments({
    schema,
    gatsbyNodeTypes,
    fragments,
  })

  gatsbyNodeTypes.forEach(config => {
    const def = compileDocument({
      schema,
      gatsbyNodeTypes,
      gatsbyFieldAliases,
      remoteTypeName: config.remoteTypeName,
      queries: parse(config.queries),
      nodeFragments: nodeFragmentMap.get(config.remoteTypeName) ?? [],
      nonNodeFragments: allNonNodeFragments,
    })
    documents.set(config.remoteTypeName, def)
  })

  return documents
}

interface ICompileDocumentArgs {
  remoteTypeName: RemoteTypeName
  gatsbyNodeTypes: Array<IGatsbyNodeConfig>
  gatsbyFieldAliases: IGatsbyFieldAliases
  schema: GraphQLSchema
  queries: DocumentNode
  nodeFragments: FragmentDefinitionNode[]
  nonNodeFragments: FragmentDefinitionNode[]
}

function compileDocument(args: ICompileDocumentArgs) {
  const fullDocument: DocumentNode = {
    ...args.queries,
    definitions: [
      ...args.queries.definitions,
      ...args.nodeFragments,
      ...args.nonNodeFragments,
    ],
  }

  // Expected query variants:
  //  1. { allUser { ...IDFragment } }
  //  2. { allNode(type: "User") { ...IDFragment } }
  //
  // We want to transform them to:
  //  1. { allUser { ...IDFragment ...UserFragment1 ...UserFragment2 }}
  //  2. { allNode(type: "User") { ...IDFragment ...UserFragment1 ...UserFragment2 }}
  const typeInfo = new TypeInfo(args.schema)

  // TODO: optimize visitor keys
  let doc: DocumentNode = visit(
    fullDocument,
    addNodeFragmentSpreadsAndTypename(args.nodeFragments)
  )
  doc = visit(
    doc,
    visitWithTypeInfo(typeInfo, addRemoteTypeNameField({ typeInfo }))
  )
  doc = visit(
    doc,
    visitWithTypeInfo(typeInfo, aliasGatsbyNodeFields({ ...args, typeInfo }))
  )
  doc = visit(
    doc,
    visitWithTypeInfo(typeInfo, addVariableDefinitions({ typeInfo }))
  )
  doc = visit(doc, removeUnusedFragments())

  // Prettify:
  return removeIdFragmentDuplicates(args, doc)
}

function removeIdFragmentDuplicates(
  args: ICompileDocumentArgs,
  doc: DocumentNode
): DocumentNode {
  // Assume ID fragment is listed first
  const idFragment = doc.definitions.find(isFragment)

  if (!idFragment) {
    throw new Error(
      `Missing ID Fragment in type config for "${args.remoteTypeName}"`
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
