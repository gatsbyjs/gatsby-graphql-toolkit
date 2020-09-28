import {
  DocumentNode,
  FieldNode,
  FragmentDefinitionNode,
  GraphQLSchema,
  InlineFragmentNode,
  parse,
  TypeInfo,
  visit,
  visitWithTypeInfo,
  specifiedDirectives,
} from "graphql"
import { flatMap } from "lodash"
import { defaultGatsbyFieldAliases } from "../config/default-gatsby-field-aliases"
import { aliasGatsbyNodeFields } from "./ast-transformers/alias-gatsby-node-fields"
import {
  GraphQLSource,
  IGatsbyFieldAliases,
  IGatsbyNodeConfig,
  ITypeNameTransform,
  RemoteTypeName,
} from "../types"
import { isFragment } from "../utils/ast-predicates"
import * as GraphQLAST from "../utils/ast-nodes"
import { createTypeNameTransform } from "../config/type-name-transform"
import { renameNode } from "../utils/ast-transform"

interface ICompileGatsbyFragmentsArgs {
  schema: GraphQLSchema
  gatsbyNodeTypes: IGatsbyNodeConfig[]
  gatsbyTypePrefix: string
  gatsbyFieldAliases?: IGatsbyFieldAliases
  typeNameTransform?: ITypeNameTransform
  customFragments:
    | Array<GraphQLSource | string>
    | Map<RemoteTypeName, GraphQLSource | string>
}

/**
 * Takes a list of custom source fragments and transforms them to
 * a list of gatsby fragments.
 *
 * E.g.
 * fragment PostAuthor on Author {
 *   id
 *   name
 *   allPosts {
 *     excerpt: description(truncateAt: 200)
 *   }
 * }
 *
 * is compiled to the following Gatsby fragment:
 *
 * fragment PostAuthor on MyAuthor {
 *   id
 *   name
 *   allPosts {
 *     excerpt
 *   }
 * }
 */
export function compileGatsbyFragments(
  args: ICompileGatsbyFragmentsArgs
): DocumentNode {
  const allFragmentDocs: DocumentNode[] = []
  args.customFragments.forEach(fragmentString => {
    allFragmentDocs.push(parse(fragmentString))
  })
  const fragments = flatMap(allFragmentDocs, doc =>
    doc.definitions.filter(isFragment)
  )

  let doc = GraphQLAST.document(fragments)

  doc = ensureGatsbyFieldAliases(args, doc)
  doc = useFieldAliases(doc)
  doc = stripArguments(doc)
  doc = stripNonSpecDirectives(doc)

  return prefixTypeConditions(args, doc)
}

function ensureGatsbyFieldAliases(
  args: ICompileGatsbyFragmentsArgs,
  doc: DocumentNode
): DocumentNode {
  const typeInfo = new TypeInfo(args.schema)

  return visit(
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
}

function stripNonSpecDirectives(doc: DocumentNode): DocumentNode {
  const specifiedDirectiveNames = new Set(
    specifiedDirectives.map(directive => directive.name)
  )
  return visit(doc, {
    Directive: (node): null | void => {
      if (specifiedDirectiveNames.has(node.name.value)) {
        return undefined
      }
      // Delete the node
      return null
    },
  })
}

function stripArguments(doc: DocumentNode): DocumentNode {
  return visit(doc, {
    Field: (node): FieldNode | void => {
      if (!node.arguments) {
        return undefined
      }
      return {
        ...node,
        arguments: undefined,
      }
    },
  })
}

function useFieldAliases(doc: DocumentNode): DocumentNode {
  return visit(doc, {
    Field: (node): FieldNode | void => {
      if (!node.alias) {
        return undefined
      }
      return {
        ...node,
        alias: undefined,
        name: node.alias,
      }
    },
  })
}

function prefixTypeConditions(
  args: ICompileGatsbyFragmentsArgs,
  doc: DocumentNode
): DocumentNode {
  const typeNameTransform =
    args.typeNameTransform ??
    createTypeNameTransform({
      gatsbyTypePrefix: args.gatsbyTypePrefix,
      gatsbyNodeTypeNames: args.gatsbyNodeTypes.map(
        type => type.remoteTypeName
      ),
    })

  return visit(doc, {
    InlineFragment: (node): InlineFragmentNode | void => {
      if (!node.typeCondition) {
        return undefined
      }
      return {
        ...node,
        typeCondition: renameNode(
          node.typeCondition,
          typeNameTransform.toGatsbyTypeName
        ),
      }
    },
    FragmentDefinition: (node): FragmentDefinitionNode | void => {
      return {
        ...node,
        typeCondition: renameNode(
          node.typeCondition,
          typeNameTransform.toGatsbyTypeName
        ),
      }
    },
  })
}
