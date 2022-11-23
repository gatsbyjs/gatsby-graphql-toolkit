import {
  ArgumentNode,
  BooleanValueNode,
  DefinitionNode,
  DirectiveNode,
  DocumentNode,
  FieldNode,
  FragmentDefinitionNode,
  FragmentSpreadNode,
  InlineFragmentNode,
  NamedTypeNode,
  NameNode,
  SelectionNode,
  SelectionSetNode,
  StringValueNode,
  ValueNode,
  Kind,
} from "graphql"

export function document(definitions: DefinitionNode[]): DocumentNode {
  return {
    kind: Kind.DOCUMENT,
    definitions,
  }
}

export function fragmentDefinition(
  fragmentName: string,
  typeName: string,
  selections: SelectionNode[]
): FragmentDefinitionNode {
  return {
    kind: Kind.FRAGMENT_DEFINITION,
    name: name(fragmentName ?? typeName),
    typeCondition: namedType(typeName),
    selectionSet: selectionSet(selections),
  }
}

export function inlineFragment(
  typeCondition: string,
  selections: readonly SelectionNode[]
): InlineFragmentNode {
  return {
    kind: Kind.INLINE_FRAGMENT,
    typeCondition: namedType(typeCondition),
    selectionSet: selectionSet(selections),
  }
}

export function selectionSet(
  selections: readonly SelectionNode[] = []
): SelectionSetNode {
  return {
    kind: Kind.SELECTION_SET,
    selections: selections,
  }
}

export function field(
  fieldName: string,
  alias?: string,
  args?: ArgumentNode[],
  selections?: SelectionNode[],
  directives?: DirectiveNode[]
): FieldNode {
  return {
    kind: Kind.FIELD,
    name: name(fieldName),
    alias: alias ? name(alias) : undefined,
    arguments: args,
    selectionSet: selectionSet(selections),
    directives,
  }
}

export function arg(argName: string, value: ValueNode): ArgumentNode {
  return {
    kind: Kind.ARGUMENT,
    name: name(argName),
    value,
  }
}

export function name(value: string): NameNode {
  return {
    kind: Kind.NAME,
    value: value,
  }
}

export function namedType(typeName: string): NamedTypeNode {
  return {
    kind: Kind.NAMED_TYPE,
    name: name(typeName),
  }
}

export function fragmentSpread(fragmentName: string): FragmentSpreadNode {
  return {
    kind: Kind.FRAGMENT_SPREAD,
    name: name(fragmentName),
  }
}

export function directive(
  directiveName: string,
  args?: ArgumentNode[]
): DirectiveNode {
  return {
    kind: Kind.DIRECTIVE,
    name: name(directiveName),
    arguments: args,
  }
}

export function skipDirective(condition: boolean = true) {
  return directive(`skip`, [arg(`if`, boolValue(condition))])
}

export function boolValue(value: boolean): BooleanValueNode {
  return {
    kind: Kind.BOOLEAN,
    value,
  }
}

export function stringValue(value: string): StringValueNode {
  return {
    kind: Kind.STRING,
    value,
  }
}
