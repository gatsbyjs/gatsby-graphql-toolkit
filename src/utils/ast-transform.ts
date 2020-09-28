import { NamedTypeNode } from "graphql"

export function renameNode<T extends NamedTypeNode>(
  node: T,
  convertName: (name: string) => string
): T {
  return {
    ...node,
    name: {
      ...node.name,
      value: convertName(node.name.value),
    },
  }
}
