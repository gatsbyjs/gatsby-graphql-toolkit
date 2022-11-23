import {
  visit,
  print,
  FieldNode,
  visitInParallel,
  visitWithTypeInfo,
  GraphQLSchema,
  GraphQLField,
  GraphQLObjectType,
  isCompositeType,
  GraphQLCompositeType,
  FragmentDefinitionNode,
  isAbstractType,
  GraphQLInterfaceType,
  GraphQLUnionType,
  getNamedType,
  ArgumentNode,
  astFromValue,
  isNonNullType,
  ASTVisitor,
  FragmentSpreadNode,
  TypeInfo,
} from "graphql"
import * as GraphQLAST from "../utils/ast-nodes"
import {
  IGatsbyNodeConfig,
  FragmentMap,
  IGatsbyFieldAliases,
  RemoteTypeName,
} from "../types"
import { defaultGatsbyFieldAliases } from "../config/default-gatsby-field-aliases"
import { aliasGatsbyNodeFields } from "./ast-transformers/alias-gatsby-node-fields"
import { stripWrappingFragments } from "./ast-transformers/strip-wrapping-fragments"
import { buildNodeReferenceFragmentMap } from "./analyze/build-node-reference-fragment-map"
import { promptUpgradeIfRequired } from "../utils/upgrade-prompt"

export interface IArgumentValueResolver {
  (field: GraphQLField<any, any>, parentType: GraphQLObjectType): void | {
    [argName: string]: unknown
  }
}

export interface IDefaultFragmentsConfig {
  schema: GraphQLSchema
  gatsbyNodeTypes: IGatsbyNodeConfig[]
  gatsbyFieldAliases?: IGatsbyFieldAliases
  defaultArgumentValues?: IArgumentValueResolver[]
}

/**
 * Utility function that generates default fragments for every gatsby node type
 */
export function generateDefaultFragments(
  config: IDefaultFragmentsConfig
): Map<RemoteTypeName, string> {
  promptUpgradeIfRequired(config.gatsbyNodeTypes)

  const result = new Map<RemoteTypeName, string>()
  for (const [name, fragment] of generateDefaultFragmentNodes(config)) {
    result.set(name, print(fragment))
  }
  return result
}

export function generateDefaultFragmentNodes(
  config: IDefaultFragmentsConfig
): Map<RemoteTypeName, FragmentDefinitionNode> {
  const context: IGenerateDefaultFragmentContext = {
    gatsbyFieldAliases: {
      ...defaultGatsbyFieldAliases,
      ...config.gatsbyFieldAliases,
    },
    schema: config.schema,
    gatsbyNodeTypes: config.gatsbyNodeTypes.reduce(
      (map, config) => map.set(config.remoteTypeName, config),
      new Map<RemoteTypeName, IGatsbyNodeConfig>()
    ),
    fragmentMap: buildTypeFragmentMap(config),
    nodeReferenceFragmentMap: buildNodeReferenceFragmentMap(config),
  }
  const nodeFragments: Map<string, FragmentDefinitionNode> = new Map()
  for (const nodeConfig of config.gatsbyNodeTypes) {
    nodeFragments.set(
      nodeConfig.remoteTypeName,
      generateDefaultFragment(context, nodeConfig)
    )
  }
  return nodeFragments
}

interface IGenerateDefaultFragmentContext {
  schema: GraphQLSchema
  gatsbyFieldAliases: IGatsbyFieldAliases
  fragmentMap: FragmentMap
  nodeReferenceFragmentMap: FragmentMap
  gatsbyNodeTypes: Map<RemoteTypeName, IGatsbyNodeConfig>
}

function generateDefaultFragment(
  context: IGenerateDefaultFragmentContext,
  nodeConfig: IGatsbyNodeConfig
): FragmentDefinitionNode {
  const fragment = context.fragmentMap.get(nodeConfig.remoteTypeName)
  if (!fragment) {
    throw new Error(`Unknown remote GraphQL type ${nodeConfig.remoteTypeName}`)
  }

  // Note:
  //  if some visitor edits a node, the next visitors won't see this node
  //  so conflicts are possible (in this case several passes are required)
  const typeInfo = new TypeInfo(context.schema)

  const visitor = visitInParallel([
    inlineNamedFragments(context),
    aliasGatsbyNodeFields({ ...context, typeInfo }),
    stripWrappingFragments(),
  ])

  return visit(fragment, visitWithTypeInfo(typeInfo, visitor))
}

function inlineNamedFragments(
  args: IGenerateDefaultFragmentContext
): ASTVisitor {
  const typeStack: string[] = []
  return {
    FragmentSpread: (node: FragmentSpreadNode, _, __) => {
      const typeName = node.name.value // Assuming fragment name matches type name

      if (typeStack.includes(typeName)) {
        // TODO: allow configurable number of nesting levels?
        // Replace the spread with a single __typename field to break the cycle
        // FIXME: delete parent field in this case vs replacing with __typename
        return GraphQLAST.field(
          `__typename`,
          args.gatsbyFieldAliases[`__typename`]
        )
      }
      typeStack.push(typeName)

      const typeFragment =
        args.nodeReferenceFragmentMap.get(typeName) ??
        args.fragmentMap.get(typeName)

      if (!typeFragment) {
        throw new Error(`Missing fragment for type ${typeName}`)
      }
      return GraphQLAST.inlineFragment(
        typeName,
        typeFragment.selectionSet.selections
      )
    },
    InlineFragment: {
      leave() {
        // Corresponding enter is actually in the FragmentSpread above
        // (FragmentSpread has no "leave" because we replace it with inline fragment or remove)
        typeStack.pop()
      },
    },
  }
}

/**
 * Create a fragment for every composite type (object, interface, union)
 * And put it to a Map<TypeName, FragmentDefinitionNode>.
 *
 * Fragment name is the same as the type name.
 *
 * Each fragment contains ALL fields of the type (arguments are omitted).
 * Fragments of this map MAY have cycles (see example below).
 *
 * This intermediate map is later used to generate final node fragment
 * by inlining and transforming specific named fragments.
 *
 * Example of generated fragments:
 *
 * ```graphql
 * fragment ObjectType on ObjectType {
 *   __typename
 *   scalar
 *   interface {
 *     ...InterfaceType
 *   }
 *   union {
 *     ...UnionType
 *   }
 *   object {
 *     ...ObjectType
 *   }
 * }
 *
 * # Fragments on abstract types simply contain __typename
 * fragment UnionType on UnionType {
 *   __typename
 * }
 * fragment InterfaceType on InterfaceType {
 *   __typename
 * }
 * ```
 */
function buildTypeFragmentMap(config: IDefaultFragmentsConfig): FragmentMap {
  const typeMap = config.schema.getTypeMap()
  const fragmentMap = new Map()

  Object.keys(typeMap).forEach(typeName => {
    const type = typeMap[typeName]
    const fragment = isCompositeType(type)
      ? buildTypeFragment(config, type)
      : undefined

    if (fragment) {
      fragmentMap.set(typeName, fragment)
    }
  })

  return fragmentMap
}

function buildTypeFragment(
  context: IDefaultFragmentsConfig,
  type: GraphQLCompositeType
): FragmentDefinitionNode {
  return isAbstractType(type)
    ? buildAbstractTypeFragment(context, type)
    : buildObjectTypeFragment(context, type)
}

function buildAbstractTypeFragment(
  context: IDefaultFragmentsConfig,
  type: GraphQLInterfaceType | GraphQLUnionType
) {
  const fragmentName = getTypeFragmentName(type.name)
  const selections = context.schema
    .getPossibleTypes(type)
    .map(objectType =>
      GraphQLAST.fragmentSpread(getTypeFragmentName(objectType.name))
    )

  return GraphQLAST.fragmentDefinition(fragmentName, type.name, selections)
}

function buildObjectTypeFragment(
  context: IDefaultFragmentsConfig,
  type: GraphQLObjectType
) {
  const fragmentName = getTypeFragmentName(type.name)
  const selections = Object.keys(type.getFields())
    .map(fieldName => buildFieldNode(context, type, fieldName))
    .filter((node): node is FieldNode => Boolean(node))

  return GraphQLAST.fragmentDefinition(fragmentName, type.name, selections)
}

function buildFieldNode(
  context: IDefaultFragmentsConfig,
  parentType: GraphQLObjectType,
  fieldName: string
): FieldNode | void {
  const field = parentType.getFields()[fieldName]
  if (!field) {
    return
  }
  const type = getNamedType(field.type)
  const args = resolveFieldArguments(context, parentType, field)

  // Make sure all nonNull args are resolved
  if (someNonNullArgMissing(field, args)) {
    return
  }
  const selections = isCompositeType(type)
    ? [GraphQLAST.fragmentSpread(getTypeFragmentName(type.name))]
    : undefined

  return GraphQLAST.field(fieldName, undefined, args, selections)
}

function resolveFieldArguments(
  context: IDefaultFragmentsConfig,
  parentType: GraphQLObjectType,
  field: GraphQLField<any, any>
): ArgumentNode[] {
  // We have two sources of arguments:
  // 1. Default argument values for type field
  // 2. Pagination adapters (i.e. limit/offset or first/after, etc)
  if (field.args.length === 0) {
    return []
  }
  const defaultArgValueProviders = context.defaultArgumentValues ?? []
  const argValues = defaultArgValueProviders.reduce(
    (argValues, resolver) =>
      Object.assign(argValues, resolver(field, parentType) ?? {}),
    Object.create(null)
  )
  return field.args
    .map(arg => {
      const valueNode = astFromValue(argValues[arg.name], arg.type)
      return valueNode ? GraphQLAST.arg(arg.name, valueNode) : undefined
    })
    .filter((arg): arg is ArgumentNode => Boolean(arg))
}

function someNonNullArgMissing(
  field: GraphQLField<any, any>,
  argNodes: ArgumentNode[]
) {
  return field.args.some(
    arg =>
      isNonNullType(arg.type) &&
      argNodes.every(argNode => argNode.name.value !== arg.name)
  )
}

function getTypeFragmentName(typeName: string): string {
  return typeName
}
