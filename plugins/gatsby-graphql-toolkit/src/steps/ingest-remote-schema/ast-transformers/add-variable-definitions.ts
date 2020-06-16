import {
  Visitor,
  ASTKindToNode,
  OperationDefinitionNode,
  VariableDefinitionNode,
  TypeInfo,
  GraphQLInputType,
  parseType,
} from "graphql"
import * as GraphQLAST from "../../../utils/ast-nodes"

interface IAddVariableDefinitionsArgs {
  typeInfo: TypeInfo
}

export function addVariableDefinitions({
  typeInfo,
}: IAddVariableDefinitionsArgs): Visitor<ASTKindToNode> {
  const variables = new Map<string, GraphQLInputType>()

  return {
    Argument: node => {
      const inputType = typeInfo.getInputType()
      if (node.value.kind === "Variable" && inputType) {
        variables.set(node.name.value, inputType)
      }
    },
    OperationDefinition: {
      leave: (node): OperationDefinitionNode | undefined => {
        if (!variables.size) {
          return
        }
        const variableDefinitions: VariableDefinitionNode[] = []
        for (const [name, inputType] of variables) {
          variableDefinitions.push({
            kind: "VariableDefinition",
            variable: {
              kind: "Variable",
              name: GraphQLAST.name(name),
            },
            type: parseType(inputType.toString()),
          })
        }
        return {
          ...node,
          variableDefinitions,
        }
      },
    },
  }
}
