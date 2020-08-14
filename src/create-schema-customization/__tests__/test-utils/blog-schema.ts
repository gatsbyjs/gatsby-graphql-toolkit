import { buildSchema } from "graphql"
import { readFileSync } from "fs"
import {
  IGatsbyNodeDefinition,
  ISchemaCustomizationContext,
  ISourcingConfig,
  RemoteTypeName,
} from "../../../types"
import { createSchemaCustomizationContext } from "../../create-schema-customization"
import { gatsbyApi } from "../../../__tests__/test-utils"

export function createBlogSchema() {
  const source = readFileSync(__dirname + "/../fixtures/schema-blog.graphql")
  return buildSchema(source.toString())
}

export function createTestContext(
  config: Partial<ISourcingConfig> = {}
): ISchemaCustomizationContext {
  return createSchemaCustomizationContext({
    schema: createBlogSchema(),
    gatsbyApi,
    gatsbyTypePrefix: `TestApi`,
    execute() {
      throw new Error("Should not execute")
    },
    gatsbyNodeDefs: new Map<RemoteTypeName, IGatsbyNodeDefinition>(),
    ...config,
  })
}
