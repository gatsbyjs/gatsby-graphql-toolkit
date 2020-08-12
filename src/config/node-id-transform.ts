import {
  IGatsbyNodeDefinition,
  INodeIdTransform,
  IRemoteNode,
  IRemoteId,
  IObject,
} from "../types"
import { Node } from "gatsby"
import { flatMap } from "lodash"
import { FragmentDefinitionNode, SelectionNode } from "graphql"
import { isField, isFragment } from "../utils/ast-nodes"

export function createNodeIdTransform(): INodeIdTransform {
  return {
    remoteNodeToGatsbyId(
      remoteNode: IRemoteNode,
      def: IGatsbyNodeDefinition
    ): string {
      const remoteId = this.remoteNodeToId(remoteNode, def)
      return this.remoteIdToGatsbyNodeId(remoteId, def)
    },
    gatsbyNodeToRemoteId(
      gatsbyNode: Node,
      def: IGatsbyNodeDefinition
    ): IRemoteId {
      const idFragment = getIdFragment(def)
      return getSelectionValues(gatsbyNode, idFragment.selectionSet.selections)
    },
    remoteIdToGatsbyNodeId(
      remoteId: IRemoteId,
      // @ts-ignore
      def: IGatsbyNodeDefinition
    ): string {
      // TODO: stable sorting as in the id fragment?
      // TODO: validate remote id (make sure it has all the fields as defined)
      const idValues = flatObjectValues(remoteId)
      return idValues.join(`:`)
    },
    remoteNodeToId(
      remoteNode: IRemoteNode,
      def: IGatsbyNodeDefinition
    ): IRemoteId {
      const idFragment = getIdFragment(def)
      return getSelectionValues(remoteNode, idFragment.selectionSet.selections)
    },
  }

  function getIdFragment(def: IGatsbyNodeDefinition): FragmentDefinitionNode {
    const fragment = def.document.definitions.find(isFragment)
    if (!fragment) {
      throw new Error(
        `Every node type definition is expected to contain a fragment ` +
          `with ID fields for this node type. Definition for ${def.remoteTypeName} has none.`
      )
    }
    return fragment
  }

  function getSelectionValues(
    obj: IObject,
    selections: ReadonlyArray<SelectionNode>
  ): IObject {
    const result = Object.create(null)
    for (const selection of selections) {
      if (!isField(selection)) {
        throw new Error("Expecting fields only")
      }
      const nestedFields: ReadonlyArray<SelectionNode> =
        selection.selectionSet?.selections ?? []

      const alias = selection.alias ?? selection.name
      const fieldName = alias.value

      const fieldValue = obj[fieldName]
      if (isNullish(fieldValue)) {
        throw new Error(
          `Value of the ID field "${fieldName}" can't be nullish. ` +
            `Got object with keys: ${Object.keys(obj).join(`, `)}`
        )
      }
      if (nestedFields.length > 0 && typeof fieldValue !== `object`) {
        throw new Error("Expecting object value for a field with selection")
      }
      result[fieldName] =
        nestedFields.length > 0
          ? getSelectionValues(fieldValue as IObject, nestedFields)
          : fieldValue
    }
    return result
  }

  function flatObjectValues(obj: object): Array<unknown> {
    return flatMap(Object.values(obj), value =>
      typeof value === `object` && value !== null
        ? flatObjectValues(value)
        : value
    )
  }
}

function isNullish(value: any) {
  return typeof value === `undefined` || value === null
}
