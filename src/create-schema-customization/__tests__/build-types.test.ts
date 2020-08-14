import { createGatsbyNodeDefinitions } from "../../__tests__/test-utils"
import { createTestContext } from "./test-utils/blog-schema"
import { buildTypeDefinition } from "../build-types"
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
        config: { interfaces: [`Node`] },
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

  describe(`Fields`, () => {
    // See build-fields.ts for a complete test suite

    it(`creates empty fields object by default`, () => {
      // Doesn't sound right but we validate against empty objects somewhere else
      const def = buildTypeDefinition(createTestContext(), `Country`)

      expect((def as GatsbyGraphQLObjectType).config.fields).toEqual({})
    })

    it(`adds fields referenced in node query`, () => {
      const gatsbyNodeDefs = createGatsbyNodeDefinitions([
        {
          remoteTypeName: `Author`,
          queries: `{
            authors {
              id
              displayName
              country {
                ...on Named { displayName }
              }
              posts { id }
            }
          }`,
        },
      ])
      const context = createTestContext({ gatsbyNodeDefs })
      const authorDef = buildTypeDefinition(context, `Author`)
      const countryDef = buildTypeDefinition(context, `Country`)

      const authorFields = (authorDef as GatsbyGraphQLObjectType).config.fields
      const countryFields = (countryDef as GatsbyGraphQLObjectType).config
        .fields

      expect(Object.keys(authorFields ?? {})).toHaveLength(4)
      expect(authorFields).toMatchObject({
        id: { type: `ID!` },
        displayName: { type: `String!` },
        country: { type: `TestApiCountry` },
        posts: { type: `[TestApiPost!]!` },
      })

      expect(Object.keys(countryFields ?? {})).toHaveLength(1)
      expect(countryFields).toMatchObject({
        displayName: { type: `String!` },
      })
    })

    it(`adds fields to node type referenced in other node type queries`, () => {
      // FIXME: we shouldn't add fields from other node type queries as
      //  they won't always resolve correctly?
      const gatsbyNodeDefs = createGatsbyNodeDefinitions([
        {
          remoteTypeName: `Author`,
          queries: `{ authors { id } }`,
        },
        {
          remoteTypeName: `Post`,
          queries: `{ posts { author { displayName } } }`,
        },
      ])
      const context = createTestContext({ gatsbyNodeDefs })
      const authorDef = buildTypeDefinition(context, `Author`)
      const authorFields = (authorDef as GatsbyGraphQLObjectType).config.fields

      expect(Object.keys(authorFields ?? {})).toHaveLength(2)
      expect(authorFields).toMatchObject({
        id: { type: `ID!` },
        displayName: { type: `String!` },
      })
    })
  })
})
