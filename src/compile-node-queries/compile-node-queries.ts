import {
  GraphQLSchema,
  DocumentNode,
  parse,
  FragmentDefinitionNode,
  TypeInfo,
  visit,
  visitWithTypeInfo,
  visitInParallel
} from "graphql"
import { flatMap } from "lodash"
import { defaultGatsbyFieldAliases } from "../config/default-gatsby-field-aliases"
import { addVariableDefinitions } from "./ast-transformers/add-variable-definitions"
import { compileNodeFragments } from "./compile-node-fragments"
import {
  IGatsbyNodeConfig,
  RemoteTypeName,
  GraphQLSource,
  IGatsbyFieldAliases,
} from "../types"
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
    doc.definitions.filter(GraphQLAST.isFragment)
  )

  const nodeFragmentMap = compileNodeFragments({
    schema,
    gatsbyNodeTypes,
    gatsbyFieldAliases,
    fragments,
  })

  gatsbyNodeTypes.forEach(config => {
    const def = compileNodeDocument({
      schema,
      gatsbyNodeType: config,
      gatsbyFieldAliases,
      queries: parse(config.queries),
      fragments: nodeFragmentMap.get(config.remoteTypeName)!, // FIXME
    })
    documents.set(config.remoteTypeName, def)
  })

  return documents
}

interface ICompileNodeDocumentArgs {
  gatsbyNodeType: IGatsbyNodeConfig
  gatsbyFieldAliases: IGatsbyFieldAliases
  schema: GraphQLSchema
  queries: DocumentNode
  fragments: FragmentDefinitionNode[]
}

function compileNodeDocument(args: ICompileNodeDocumentArgs) {
  const fullDocument: DocumentNode = {
    ...args.queries,
    definitions: args.queries.definitions.concat(args.fragments),
  }

  // Expected query variants:
  //  1. { allUser }
  //  2. { allNode(type: "User") }
  //
  // We want to transform them to:
  //  1. { allUser { ...UserFragment1 ...UserFragment2 }}
  //  2. { allNode(type: "User") { ...UserFragment1 ...UserFragment2 }}
  //
  const typeInfo = new TypeInfo(args.schema)

  return visit(
    fullDocument,
    visitWithTypeInfo(
      typeInfo,
      visitInParallel([
        {
          FragmentDefinition: () => false, // skip fragments
          SelectionSet: {
            leave: node => {
              if (node.selections.some(GraphQLAST.isFragmentSpread)) {
                return GraphQLAST.selectionSet([
                  ...node.selections,
                  ...args.fragments.map(fragment =>
                    GraphQLAST.fragmentSpread(fragment.name.value)
                  ),
                ])
              }
              return undefined
            }
          },
        },
        addVariableDefinitions({ typeInfo }),
      ])
    )
  )
}
