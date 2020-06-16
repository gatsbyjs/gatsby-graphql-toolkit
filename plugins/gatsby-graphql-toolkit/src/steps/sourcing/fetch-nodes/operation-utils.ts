import { DocumentNode, OperationDefinitionNode } from "graphql"

export function collectListOperationNames(document: DocumentNode): string[] {
  return collectOperationNames(document, /^ALL/)
}

export function collectNodeOperationNames(document: DocumentNode): string[] {
  return collectOperationNames(document, /^ONE/)
}

export function collectPaginateFieldOperationNames(document: DocumentNode): string[] {
  return collectOperationNames(document, /^PAGINATE/)
}

function collectOperationNames(document: DocumentNode, regex: RegExp) {
  return document.definitions
    .filter(
      (def): def is OperationDefinitionNode =>
        def.kind === "OperationDefinition"
    )
    .map(def => (def.name ? def.name.value : ``))
    .filter(name => regex.test(name))
}
