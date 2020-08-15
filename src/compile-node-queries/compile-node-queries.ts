import {
  DocumentNode,
  FragmentDefinitionNode,
  GraphQLSchema,
  parse,
  TypeInfo,
  visit,
  visitInParallel,
  visitWithTypeInfo
} from "graphql"
import { flatMap } from "lodash"
import { defaultGatsbyFieldAliases } from "../config/default-gatsby-field-aliases"
import { addVariableDefinitions } from "./ast-transformers/add-variable-definitions"
import { aliasGatsbyNodeFields } from "./ast-transformers/alias-gatsby-node-fields"
import { addFragmentSpreadsAndTypename } from "./ast-transformers/add-fragment-spreads-and-typename"
import { compileNodeFragments } from "./compile-node-fragments"
import { GraphQLSource, IGatsbyFieldAliases, IGatsbyNodeConfig, RemoteTypeName } from "../types"
import { selectionSetIncludes } from "../utils/ast-compare"
import { isFragment } from "../utils/ast-predicates"

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

  gatsbyNodeTypes.forEach(config => {
    const def = compileDocument({
      schema,
      gatsbyNodeTypes,
      gatsbyFieldAliases,
      remoteTypeName: config.remoteTypeName,
      queries: parse(config.queries),
      fragments: nodeFragmentMap.get(config.remoteTypeName)!, // FIXME
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
  fragments: FragmentDefinitionNode[]
}

function compileDocument(args: ICompileDocumentArgs) {
  const fullDocument: DocumentNode = {
    ...args.queries,
    definitions: args.queries.definitions.concat(args.fragments),
  }

  // Expected query variants:
  //  1. { allUser { ...IDFragment } }
  //  2. { allNode(type: "User") { ...IDFragment } }
  //
  // We want to transform them to:
  //  1. { allUser { ...IDFragment ...UserFragment1 ...UserFragment2 }}
  //  2. { allNode(type: "User") { ...IDFragment ...UserFragment1 ...UserFragment2 }}
  const typeInfo = new TypeInfo(args.schema)

  const doc: DocumentNode = visit(
    fullDocument,
    visitWithTypeInfo(
      typeInfo,
      visitInParallel([
        addFragmentSpreadsAndTypename(args.fragments),
        aliasGatsbyNodeFields({ ...args, typeInfo }),
        addVariableDefinitions({ typeInfo }),
      ])
    )
  )
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
