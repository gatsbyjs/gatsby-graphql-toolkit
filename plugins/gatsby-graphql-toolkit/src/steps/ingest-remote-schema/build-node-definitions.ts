import { GraphQLSchema, parse } from "graphql"
import { defaultGatsbyFieldAliases } from "../../config/default-gatsby-field-aliases"
import { compileGatsbyNodeDocument } from "./compile-queries/compile-node-document"
import { compileNodeFragments } from "./compile-queries/compile-node-fragments"
import {
  IGatsbyNodeConfig,
  IGatsbyNodeDefinition,
  RemoteTypeName,
  GraphQLSource,
  IGatsbyFieldAliases,
} from "../../types"
import * as GraphQLAST from "../../utils/ast-nodes"

interface IBuildNodeDefinitionArgs {
  schema: GraphQLSchema
  gatsbyTypePrefix: string
  gatsbyNodeTypes: IGatsbyNodeConfig[]
  gatsbyFieldAliases?: IGatsbyFieldAliases
  customFragments: Array<GraphQLSource>
}

export function buildNodeDefinitions({
  schema,
  gatsbyNodeTypes,
  gatsbyFieldAliases = defaultGatsbyFieldAliases,
  customFragments,
}: IBuildNodeDefinitionArgs): Map<RemoteTypeName, IGatsbyNodeDefinition> {
  const definitions = new Map<RemoteTypeName, IGatsbyNodeDefinition>()
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
    const def: IGatsbyNodeDefinition = {
      ...config,
      document: compileGatsbyNodeDocument({
        schema,
        gatsbyNodeType: config,
        gatsbyFieldAliases,
        queries: parse(config.queries),
        fragments: nodeFragmentMap.get(config.remoteTypeName)!, // FIXME
      }),
    }
    definitions.set(config.remoteTypeName, def)
  })
  return definitions
}
