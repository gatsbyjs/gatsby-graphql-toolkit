import { GraphQLSchema, DocumentNode, parse } from "graphql"
import { defaultGatsbyFieldAliases } from "../../config/default-gatsby-field-aliases"
import { compileNodeDocument } from "./compile-queries/compile-node-document"
import { compileNodeFragments } from "./compile-queries/compile-node-fragments"
import {
  IGatsbyNodeConfig,
  RemoteTypeName,
  GraphQLSource,
  IGatsbyFieldAliases,
} from "../../types"
import * as GraphQLAST from "../../utils/ast-nodes"

interface ICompileNodeDocumentsArgs {
  schema: GraphQLSchema
  gatsbyNodeTypes: IGatsbyNodeConfig[]
  gatsbyFieldAliases?: IGatsbyFieldAliases
  customFragments: Array<GraphQLSource>
}

export function compileNodeQueries({
  schema,
  gatsbyNodeTypes,
  gatsbyFieldAliases = defaultGatsbyFieldAliases,
  customFragments,
}: ICompileNodeDocumentsArgs): Map<RemoteTypeName, DocumentNode> {
  const documents = new Map<RemoteTypeName, DocumentNode>()
  const fragments = customFragments
    .map(fragment => parse(fragment))
    .flatMap(doc => doc.definitions.filter(GraphQLAST.isFragment))

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
