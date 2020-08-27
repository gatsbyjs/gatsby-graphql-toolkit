import { createTestContext } from "./test-utils/blog-schema"
import { buildFields } from "../build-fields"
import { createGatsbyNodeDefinitions } from "../../__tests__/test-utils"
import { buildTypeDefinition } from "../build-types"
import { IGatsbyNodeConfig } from "../../types"

describe(`Collect fields from queries`, () => {
  it(`collects empty object when nothing is queried`, () => {
    const objFields = buildFields(createTestContext(), `Author`)
    const interfaceFields = buildFields(createTestContext(), `Entry`)

    expect(objFields).toEqual({})
    expect(interfaceFields).toEqual({})
  })

  it.todo(`collects all fields referenced in queries for this type`)
  it.todo(
    `additionally collects fields from all type interfaces for object types`
  )
  it(`collects field aliases as type fields`, () => {
    const entryFields = buildTypeFields(`Category`, [
      {
        remoteTypeName: `Category`,
        queries: `{
          categories {
            entries { id }
            aliasedEntries: entries { id }
            displayName
            aliasedDisplayName: displayName
          }
        }`,
      },
    ])

    expect(Object.keys(entryFields ?? {})).toHaveLength(4)
    expect(entryFields).toMatchObject({
      "aliasedDisplayName": {
        "type": "String!"
      },
      "aliasedEntries": {
        "type": "[TestApiEntry]"
      },
      "displayName": {
        "type": "String!"
      },
      "entries": {
        "type": "[TestApiEntry]"
      }
    })
  })
  it.todo(`correctly skips __typename field`)

  it.todo(`collects fields of type object`)
  it.todo(`collects fields of type object with listOf and nonNull wrappers`)

  it.todo(`collects fields of gatsby node types`)
  it.todo(
    `collects fields of gatsby node types with listOf and nonNull wrappers`
  )

  it.todo(`collects fields of interface type`)
  it.todo(`collects fields of interface type with listOf and nonNull wrappers`)

  it.todo(`collects fields of union type`)
  it.todo(`collects fields of union type with listOf and nonNull wrappers`)

  it.todo(`collects fields of internal scalar types`)
  it.todo(
    `collects fields of internal scalar types with listOf and nonNull wrappers`
  )

  it.todo(`collects fields of custom scalar types`)
  it.todo(
    `collects fields of custom scalar types with listOf and nonNull wrappers`
  )

  it.todo(`collects enum fields`)
  it.todo(`collects enum fields with listOf and nonNull wrappers`)

  it.todo(`collects and transforms paginated fields`)
})

describe(`Interface type fields`, () => {
  it(`collects all fields of interface type`, () => {
    const entryFields = buildTypeFields(`Entry`, [
      {
        remoteTypeName: `Category`,
        queries: `{ categories { entries { id } } }`,
      },
    ])

    expect(Object.keys(entryFields ?? {})).toHaveLength(1)
    expect(entryFields).toEqual({
      id: { type: `ID!` },
    })
  })

  it(`adds aliased __typename to interface fields`, () => {
    const entryFields = buildTypeFields(`Entry`, [
      {
        remoteTypeName: `Category`,
        queries: `{ categories { entries { remoteTypeName: __typename } } }`,
      },
    ])

    expect(Object.keys(entryFields ?? {})).toHaveLength(1)
    expect(entryFields).toEqual({
      remoteTypeName: { type: `String!` },
    })
  })

  it(`doesn't add fields referenced in implementations only`, () => {
    const entryFields = buildTypeFields(`Entry`, [
      {
        remoteTypeName: `Author`,
        queries: `{ author { id } }`,
      },
    ])

    expect(entryFields).toEqual({})
  })

  it(`adds fields from inline fragments defined on interface`, () => {
    const entryFields = buildTypeFields(`Entry`, [
      {
        remoteTypeName: `Author`,
        queries: `{ author { ...on Entry { id } } }`,
      },
    ])

    expect(entryFields).toEqual({
      id: { type: `ID!` },
    })
  })

  it(`adds fields from fragments defined on interface`, () => {
    const entryFields = buildTypeFields(`Entry`, [
      {
        remoteTypeName: `Author`,
        queries: `
          { author { ...EntryFragment } }
          fragment EntryFragment on Entry { id }
        `,
      },
    ])

    expect(entryFields).toEqual({
      id: { type: `ID!` },
    })
  })
})

function buildTypeFields(
  remoteTypeName: string,
  nodeDefs: Array<IGatsbyNodeConfig>
) {
  const gatsbyNodeDefs = createGatsbyNodeDefinitions(nodeDefs)
  const context = createTestContext({ gatsbyNodeDefs })
  const typeDef = buildTypeDefinition(context, remoteTypeName)
  // FIXME: export GatsbyGraphQLInterfaceType from gatsby
  // @ts-ignore
  return typeDef.config.fields
}
