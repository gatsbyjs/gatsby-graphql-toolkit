import {
  FieldNode,
  FragmentDefinitionNode,
  GraphQLInterfaceType,
  GraphQLObjectType,
  GraphQLSchema,
  isObjectType,
  parse,
  SelectionNode,
} from "graphql"
import { flatMap } from "lodash"
import { FragmentMap, IGatsbyNodeConfig, RemoteTypeName } from "../../types"
import * as GraphQLAST from "../../utils/ast-nodes"
import { isField, isFragment } from "../../utils/ast-predicates"

/**
 * Create reference fragment for every node type
 * and put it to a Map<TypeName, FragmentDefinitionNode>.
 *
 * "Reference fragment" is a fragment that contains all necessary fields
 * required to find the actual node in gatsby store (i.e. type, id).
 *
 * For example:
 *
 * fragment NodeTypeReference on NodeType {
 *   remoteTypeName: __typename
 *   remoteNodeId: id
 * }
 *
 * Resulting map also includes fragments for node interfaces.
 * "Node interface" is an interface having only node types as it's implementors
 *
 * (if there is at least one non-node type then an interface
 * can not be considered a "node interface")
 */
export function buildNodeReferenceFragmentMap({
  schema,
  gatsbyNodeTypes: nodes,
}: {
  schema: GraphQLSchema
  gatsbyNodeTypes: IGatsbyNodeConfig[]
}): FragmentMap {
  const nodeReferenceFragmentMap: FragmentMap = new Map()
  const possibleNodeInterfaces: GraphQLInterfaceType[] = []
  const nodesMap = new Map<RemoteTypeName, FragmentDefinitionNode>()

  // Add reference fragments for simple node object types
  // TODO: move config validation to a separate step
  nodes.forEach((config, index) => {
    if (!config.remoteTypeName) {
      throw new Error(
        `Every node type definition is expected to have key "remoteTypeName". ` +
          `But definition at index ${index} has none.`
      )
    }
    if (!config.queries) {
      throw new Error(
        `Every node type definition is expected to have key "queries". ` +
          `But definition for ${config.remoteTypeName} has none.`
      )
    }
    const remoteTypeName = config.remoteTypeName
    const nodeType = schema.getType(remoteTypeName)
    if (!isObjectType(nodeType)) {
      throw new Error(
        `Only object types can be defined as gatsby nodes. Got ${remoteTypeName} ` +
          `(for definition at index ${index})`
      )
    }
    const document = parse(config.queries)
    const fragments = document.definitions.filter(isFragment)
    if (fragments.length !== 1) {
      throw new Error(
        `Every node type query is expected to contain a single fragment ` +
          `with ID fields for this node type. Definition for ${remoteTypeName} has none.`
      )
    }
    const idFragment = fragments[0]
    if (idFragment.typeCondition.name.value !== remoteTypeName) {
      throw new Error(
        `Fragment ${idFragment.name.value} for node type ${remoteTypeName} ` +
          `is incorrectly defined on type ${idFragment.typeCondition.name.value}`
      )
    }
    const referenceFragment: FragmentDefinitionNode = GraphQLAST.fragmentDefinition(
      remoteTypeName,
      remoteTypeName,
      [
        GraphQLAST.field(`__typename`),
        ...idFragment.selectionSet.selections.filter(
          selection => !isTypeName(selection)
        ),
      ]
    )
    nodeReferenceFragmentMap.set(remoteTypeName, referenceFragment)
    possibleNodeInterfaces.push(...nodeType.getInterfaces())
    nodesMap.set(remoteTypeName, referenceFragment)
  })

  // Detect node interfaces and add reference fragments for those
  // Node interface is any interface that has all of it's implementors configured
  //   as Gatsby node types and also having all ID fields of all implementors
  new Set<GraphQLInterfaceType>(possibleNodeInterfaces).forEach(iface => {
    const possibleTypes = schema.getPossibleTypes(iface)
    if (!allPossibleTypesAreNodeTypes(possibleTypes, nodesMap)) {
      return
    }
    const referenceFragment = combineReferenceFragments(
      iface.name,
      possibleTypes,
      nodesMap
    )
    if (!hasAllIdFields(iface, referenceFragment)) {
      return
    }
    nodeReferenceFragmentMap.set(iface.name, referenceFragment)
  })

  return nodeReferenceFragmentMap
}

function allPossibleTypesAreNodeTypes(
  possibleTypes: readonly GraphQLObjectType[],
  nodesMap: Map<RemoteTypeName, FragmentDefinitionNode>
): boolean {
  return possibleTypes.every(type => nodesMap.has(type.name))
}

function combineReferenceFragments(
  interfaceName: string,
  possibleTypes: readonly GraphQLObjectType[],
  nodesMap: Map<RemoteTypeName, FragmentDefinitionNode>
): FragmentDefinitionNode {
  const allIdFields = flatMap(
    possibleTypes,
    type => nodesMap.get(type.name)?.selectionSet.selections ?? []
  ).filter(isField)

  return GraphQLAST.fragmentDefinition(
    interfaceName,
    interfaceName,
    dedupeFieldsRecursively(allIdFields.filter(isField))
  )
}

function dedupeFieldsRecursively(fields: FieldNode[]): FieldNode[] {
  const uniqueFields = new Map<string, FieldNode[]>()

  fields.forEach(field => {
    const fieldName = field.name.value
    const subFields = field.selectionSet?.selections.filter(isField) ?? []

    uniqueFields.set(fieldName, [
      ...(uniqueFields.get(fieldName) ?? []),
      ...subFields,
    ])
  })

  const result: FieldNode[] = []
  for (const [fieldName, subFields] of uniqueFields) {
    const field = GraphQLAST.field(
      fieldName,
      undefined,
      undefined,
      dedupeFieldsRecursively(subFields)
    )
    result.push(field)
  }
  return result
}

function hasAllIdFields(
  iface: GraphQLInterfaceType,
  idFragment: FragmentDefinitionNode
): boolean {
  // TODO: also check nested fields?
  const fields = iface.getFields()
  for (const field of idFragment.selectionSet.selections) {
    if (!isField(field)) {
      return false
    }
    const fieldName = field.name.value
    if (!fields[fieldName] && fieldName !== `__typename`) {
      return false
    }
  }
  return true
}

function isTypeName(selection: SelectionNode): boolean {
  return selection.kind === "Field" && selection.name.value === `__typename`
}
