import { createBlogSchema, gatsbyApi } from "../../__tests__/test-utils"
import { createSchemaCustomizationContext } from "../create-schema-customization"
import { buildTypeDefinition } from "../build-types"
import {
  IGatsbyNodeConfig,
  IGatsbyNodeDefinition,
  IRemoteId,
  ISourcingConfig,
  RemoteTypeName,
} from "../../types"
import { parse } from "graphql"
import { GatsbyGraphQLObjectType } from "gatsby"

describe(`Build objectType`, () => {
  it(`creates config for simple object type`, () => {
    const def = buildTypeDefinition(createTestContext(), `Country`)

    expect(def).toMatchObject({ kind: "OBJECT" })
  })

  it(`prefixes remote type name`, () => {
    const context = createTestContext({ gatsbyTypePrefix: "TestPrefix" })
    const def = buildTypeDefinition(context, `Country`)

    expect(def).toMatchObject({
      config: { name: "TestPrefixCountry" },
    })
  })

  it(`doesn't set extensions for non-node object type`, () => {
    const def = buildTypeDefinition(createTestContext(), `Country`)

    expect((def as GatsbyGraphQLObjectType).config.extensions).toEqual({})
  })

  it(`sets "infer: false" extension for gatsby node type`, () => {
    const gatsbyNodeDefs = createGatsbyNodeDefinitions([
      { remoteTypeName: `Author`, queries: `{ authors { id } }` },
    ])
    const context = createTestContext({ gatsbyNodeDefs })
    const nodeDef = buildTypeDefinition(context, `Author`)
    const simpleDef = buildTypeDefinition(context, `Country`)

    expect(nodeDef).toMatchObject({
      config: {
        extensions: { infer: false },
      },
    })
    expect((simpleDef as GatsbyGraphQLObjectType).config.extensions).toEqual({})
  })

  describe(`Interfaces`, () => {
    it(`doesn't add interfaces by default`, () => {
      const def = buildTypeDefinition(createTestContext(), `Author`)

      expect(def).toMatchObject({
        config: { interfaces: [] },
      })
    })

    it(`adds Node interface to types configured as gatsby node`, () => {
      const gatsbyNodeDefs = createGatsbyNodeDefinitions([
        {
          remoteTypeName: `Author`,
          queries: `{ authors { id } }`,
        },
      ])
      const context = createTestContext({ gatsbyNodeDefs })
      const nodeDef = buildTypeDefinition(context, `Author`)

      expect(nodeDef).toMatchObject({
        config: { interfaces: [`Node`] },
      })
    })

    it(`doesn't add remote interfaces if they were not referenced in queried`, () => {
      // FIXME: maybe add if interface field was requested from any implementation?
      const gatsbyNodeDefs = createGatsbyNodeDefinitions([
        {
          remoteTypeName: `Author`,
          queries: `{ authors { country { displayName } } }`,
        },
      ])
      const context = createTestContext({ gatsbyNodeDefs })
      const nodeDef = buildTypeDefinition(context, `Author`)
      const simpleDef = buildTypeDefinition(context, `Country`)

      expect(nodeDef).toMatchObject({
        config: { interfaces: [`Node`] }
      })
      expect(simpleDef).toMatchObject({
        config: { interfaces: [] },
      })
    })

    it(`adds remote interfaces if they were referenced in queries`, () => {
      const gatsbyNodeDefs = createGatsbyNodeDefinitions([
        {
          remoteTypeName: `Author`,
          queries: `{
            authors {
              country {
                ...on Named { displayName }
              }
            }
          }`,
        },
      ])
      const context = createTestContext({ gatsbyNodeDefs })
      const nodeDef = buildTypeDefinition(context, `Author`)
      const simpleDef = buildTypeDefinition(context, `Country`)

      expect(nodeDef).toMatchObject({
        config: { interfaces: [`TestApiNamed`, `Node`] },
      })
      expect(simpleDef).toMatchObject({
        config: { interfaces: [`TestApiNamed`] },
      })
    })
  })
})

function createGatsbyNodeDefinitions(defs: Array<Partial<IGatsbyNodeConfig>>) {
  const gatsbyNodeDefs = new Map<RemoteTypeName, IGatsbyNodeDefinition>()

  defs.forEach(def => {
    if (!def.remoteTypeName) {
      throw new Error("remoteTypeName must be set")
    }
    gatsbyNodeDefs.set(def.remoteTypeName, {
      remoteTypeName: def.remoteTypeName,
      remoteIdFields: [`id`],
      document: parse(def.queries ?? ``),
      nodeQueryVariables: (id: IRemoteId) => ({ ...id }),
      ...def,
    })
  })

  return gatsbyNodeDefs
}

function createTestContext(config: Partial<ISourcingConfig> = {}) {
  const gatsbyNodeDefs = new Map<RemoteTypeName, IGatsbyNodeDefinition>()

  return createSchemaCustomizationContext({
    schema: createBlogSchema(),
    gatsbyApi,
    gatsbyTypePrefix: `TestApi`,
    execute() {
      throw new Error("Should not execute")
    },
    gatsbyNodeDefs,
    ...config,
  })
}
