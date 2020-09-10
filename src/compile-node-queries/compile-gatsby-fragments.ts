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
import { aliasGatsbyNodeFields } from "./ast-transformers/alias-gatsby-node-fields"
import {
  GraphQLSource,
  IGatsbyFieldAliases,
  IGatsbyNodeConfig,
  RemoteTypeName,
} from "../types"
import { isFragment } from "../utils/ast-predicates"
import * as GraphQLAST from "../utils/ast-nodes"
import { createTypeNameTransform } from "../config/type-name-transform"

interface ICompileNodeQueriesArgs {
  schema: GraphQLSchema
  gatsbyNodeTypes: IGatsbyNodeConfig[]
  gatsbyTypePrefix: string
  gatsbyFieldAliases?: IGatsbyFieldAliases
  customFragments:
    | Array<GraphQLSource | string>
    | Map<RemoteTypeName, GraphQLSource | string>
}

/**
 * Combines `queries` from node types config with any user-defined
 * fragments and produces final queries used for node sourcing.
 */
export function compileGatsbyFragments(
  args: ICompileNodeQueriesArgs
): DocumentNode {
  const allFragmentDocs: DocumentNode[] = []
  args.customFragments.forEach(fragmentString => {
    allFragmentDocs.push(parse(fragmentString))
  })
  const fragments = flatMap(allFragmentDocs, doc =>
    doc.definitions.filter(isFragment)
  )

  const typeInfo = new TypeInfo(args.schema)
  const typeNameTransform = createTypeNameTransform({
    gatsbyTypePrefix: args.gatsbyTypePrefix,
    gatsbyNodeTypeNames: args.gatsbyNodeTypes.map(type => type.remoteTypeName),
  })

  let doc = GraphQLAST.document(fragments)

  doc = visit(
    doc,
    visitWithTypeInfo(
      typeInfo,
      aliasGatsbyNodeFields({
        schema: args.schema,
        gatsbyNodeTypes: args.gatsbyNodeTypes.reduce(
          (map, config) => map.set(config.remoteTypeName, config),
          new Map<RemoteTypeName, IGatsbyNodeConfig>()
        ),
        typeInfo,
        gatsbyFieldAliases:
          args.gatsbyFieldAliases ?? defaultGatsbyFieldAliases,
      })
    )
  )

  return visit(
    doc,
    visitWithTypeInfo(typeInfo, {
      FragmentDefinition: (node): FragmentDefinitionNode | void => {
        return {
          ...node,
          typeCondition: {
            ...node.typeCondition,
            name: {
              ...node.typeCondition.name,
              value: typeNameTransform.toGatsbyTypeName(
                node.typeCondition.name.value
              ),
            },
          },
        }
      },
    })
  )
}
