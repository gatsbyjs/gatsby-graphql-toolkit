import { ISchemaCustomizationContext, ISourcingConfig } from "../types"
import { buildTypeDefinitions } from "./build-types"
import { buildSourcingPlan } from "./analyze/build-sourcing-plan"
import { createNodeIdTransform } from "../config/node-id-transform"
import { createTypeNameTransform } from "../config/type-name-transform"
import { defaultGatsbyFieldAliases } from "../config/default-gatsby-field-aliases"

/**
 * Uses sourcing config to define Gatsby types explicitly
 * (using Gatsby schema customization API).
 */
export async function createSchemaCustomization(config: ISourcingConfig) {
  const context = createSchemaCustomizationContext(config)
  const typeDefs = buildTypeDefinitions(context)
  context.gatsbyApi.actions.createTypes(typeDefs)
}

export function createSchemaCustomizationContext(
  config: ISourcingConfig
): ISchemaCustomizationContext {
  const gatsbyFieldAliases =
    config.gatsbyFieldAliases ?? defaultGatsbyFieldAliases

  const {
    idTransform = createNodeIdTransform(),
    typeNameTransform = createTypeNameTransform(config.gatsbyTypePrefix),
  } = config

  return {
    ...config,
    gatsbyFieldAliases,
    idTransform,
    typeNameTransform,
    sourcingPlan: buildSourcingPlan(config),
  }
}
