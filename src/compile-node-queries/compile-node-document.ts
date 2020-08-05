import {
  GraphQLSchema,
  DocumentNode,
  TypeInfo,
  visit,
  visitWithTypeInfo,
  visitInParallel,
  FragmentDefinitionNode,
} from "graphql"
import * as GraphQLAST from "../utils/ast-nodes"
import { addVariableDefinitions } from "./ast-transformers/add-variable-definitions"
import { IGatsbyFieldAliases, IGatsbyNodeConfig } from "../types"

interface ICompileNodeDocumentArgs {
  gatsbyNodeType: IGatsbyNodeConfig
  gatsbyFieldAliases: IGatsbyFieldAliases
  schema: GraphQLSchema
  queries: DocumentNode
  fragments: FragmentDefinitionNode[]
}

export function compileNodeDocument(args: ICompileNodeDocumentArgs) {
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
