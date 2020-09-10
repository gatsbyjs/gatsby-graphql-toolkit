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
import * as GraphQLAST from "../utils/ast-nodes"

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
    const def = compileDocument(
      context,
      config.remoteTypeName,
      nodeFragmentMap.get(config.remoteTypeName) ?? [],
      allNonNodeFragments
    )
    documents.set(config.remoteTypeName, def)
  })

  return documents
}

function compileDocument(
  context: ICompileQueriesContext,
  remoteTypeName: RemoteTypeName,
  nodeFragments: FragmentDefinitionNode[],
  nonNodeFragments: FragmentDefinitionNode[]
): DocumentNode {
  const queries = context.originalConfigQueries.get(remoteTypeName)

  if (!queries) {
    throw new Error(
      `Could not find "queries" config for type "${remoteTypeName}"`
    )
  }

  // Remove redundant node fragments that contain the same fields as the id fragment
  // (doesn't affect query results but makes queries more readable):
  const prettifiedNodeFragments = removeIdFragmentDuplicates(
    context,
    nodeFragments,
    getIdFragment(remoteTypeName, queries)
  )

  const typeInfo = new TypeInfo(context.schema)

  let fragmentsDocument = GraphQLAST.document([
    ...prettifiedNodeFragments,
    ...nonNodeFragments,
  ])

  // Adding automatic __typename to custom fragments only
  // (original query and ID fragment must not be altered)
  fragmentsDocument = visit(
    fragmentsDocument,
    visitWithTypeInfo(typeInfo, addRemoteTypeNameField({ typeInfo }))
  )

  const fullDocument: DocumentNode = {
    ...queries,
    definitions: [...queries.definitions, ...fragmentsDocument.definitions],
  }

  // Expected query variants:
  //  1. { allUser { ...IDFragment } }
  //  2. { allNode(type: "User") { ...IDFragment } }
  //
  // We want to transform them to:
  //  1. { allUser { ...IDFragment ...UserFragment1 ...UserFragment2 }}
  //  2. { allNode(type: "User") { ...IDFragment ...UserFragment1 ...UserFragment2 }}

  // TODO: optimize visitor keys
  let doc: DocumentNode = visit(
    fullDocument,
    addNodeFragmentSpreadsAndTypename(prettifiedNodeFragments)
  )

  doc = visit(
    doc,
    visitWithTypeInfo(typeInfo, aliasGatsbyNodeFields({ ...context, typeInfo }))
  )
  doc = visit(
    doc,
    visitWithTypeInfo(typeInfo, addVariableDefinitions({ typeInfo }))
  )

  return visit(doc, removeUnusedFragments())
}

function getIdFragment(
  remoteTypeName: RemoteTypeName,
  doc: DocumentNode
): FragmentDefinitionNode {
  // Assume ID fragment is listed first
  const idFragment = doc.definitions.find(isFragment)
  if (!idFragment) {
    throw new Error(
      `Missing ID Fragment in type config for "${remoteTypeName}"`
    )
  }
  return idFragment
}

function removeIdFragmentDuplicates(
  context: ICompileQueriesContext,
  fragments: FragmentDefinitionNode[],
  idFragment: FragmentDefinitionNode
): FragmentDefinitionNode[] {
  // The caveat is that a custom fragment may already have aliases but ID fragment hasn't:
  //
  // fragment Foo on Foo {
  //   remoteTypeName: __typename
  // }
  //
  // ID fragment:
  // fragment _FooId_ on Foo {
  //   __typename
  //   id
  // }
  // So before comparing selections we must "normalize" both to the form they
  // will be in the actual query
  const typeInfo = new TypeInfo(context.schema)
  let fragmentsWithAliases = GraphQLAST.document(fragments)

  const idFragmentWithAliases = visit(
    idFragment,
    visitWithTypeInfo(typeInfo, aliasGatsbyNodeFields({ ...context, typeInfo }))
  )
  fragmentsWithAliases = visit(
    fragmentsWithAliases,
    visitWithTypeInfo(typeInfo, aliasGatsbyNodeFields({ ...context, typeInfo }))
  )
  const deduped = new Set(
    fragmentsWithAliases.definitions
      .filter(
        (def): def is FragmentDefinitionNode =>
          isFragment(def) &&
          def.name.value !== idFragment.name.value &&
          !selectionSetIncludes(
            idFragmentWithAliases.selectionSet,
            def.selectionSet
          )
      )
      .map(fragment => fragment.name.value)
  )
  return fragments.filter(f => deduped.has(f.name.value))
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
