import { parse, print, buildSchema, DocumentNode } from "graphql"
import { compileNodeQueries } from "../compile-node-queries"
import { IGatsbyNodeConfig, RemoteTypeName } from "../../types"

describe(`Schema with simple types`, () => {
  const schema = buildSchema(`
    enum FooBarEnum {
      FOO
      BAR
    }
    type Foo {
      testId: ID
      string: String
      int: Int
      float: Float
      enum: FooBarEnum
      withWrappers: [String!]!
    }
    type Bar {
      testId: ID
      foo: Foo
      bar: String
    }
    type GatsbyFields {
      id: ID
      internal: String
      parent: String
      children: String 
    }
    type WithGatsbyFields {
      id: ID
      internal: String
      parent: String
      children: String
      fields: GatsbyFields
    }
  `)

  const nodeTypes: {
    Foo: IGatsbyNodeConfig
    Bar: IGatsbyNodeConfig
    WithGatsbyFields: IGatsbyNodeConfig
  } = {
    Foo: {
      remoteTypeName: `Foo`,
      queries: `
        query LIST_Foo { allFoo { ...FooId } }
        fragment FooId on Foo { testId }
      `,
    },
    Bar: {
      remoteTypeName: `Bar`,
      queries: `
        query LIST_Bar { allBar { ...BarId } }
        fragment BarId on Bar { testId }
      `,
    },
    WithGatsbyFields: {
      remoteTypeName: `WithGatsbyFields`,
      queries: `
        query LIST_WithGatsbyFields { allWithGatsbyFields { ...WithGatsbyFieldsId } }
        fragment WithGatsbyFieldsId on WithGatsbyFields { __typename id }
      `
    }
  }

  it(`adds __typename in the top-level query`, () => {
    const queries = compileNodeQueries({
      schema,
      gatsbyNodeTypes: [nodeTypes.Foo],
      customFragments: [],
    })

    expect(queries.size).toEqual(1)
    expect(printQuery(queries, `Foo`)).toEqual(dedent`
      query LIST_Foo {
        allFoo {
          remoteTypeName: __typename
          ...FooId
        }
      }
      fragment FooId on Foo { testId }
    `)
  })

  it(`works without custom fragments`, () => {
    const queries = compileNodeQueries({
      schema,
      gatsbyNodeTypes: [nodeTypes.Foo, nodeTypes.Bar],
      customFragments: [],
    })

    expect(queries.size).toEqual(2)
    expect(printQuery(queries, `Foo`)).toEqual(dedent`
      query LIST_Foo {
        allFoo {
          remoteTypeName: __typename
          ...FooId
        }
      }
      fragment FooId on Foo { testId }
    `)
    expect(printQuery(queries, `Bar`)).toEqual(dedent`
      query LIST_Bar {
        allBar {
          remoteTypeName: __typename
          ...BarId
        }
      }
      fragment BarId on Bar { testId }
    `)
  })

  it(`works with a single custom fragment`, () => {
    const queries = compileNodeQueries({
      schema,
      gatsbyNodeTypes: [nodeTypes.Foo, nodeTypes.Bar],
      customFragments: [`fragment Foo on Foo { string }`],
    })

    expect(queries.size).toEqual(2)
    expect(printQuery(queries, `Foo`)).toEqual(dedent`
      query LIST_Foo {
        allFoo {
          remoteTypeName: __typename
          ...FooId
          ...Foo
        }
      }
      
      fragment FooId on Foo {
        testId
      }
      
      fragment Foo on Foo {
        string
      }
    `)
  })

  it(`replaces node selections with reference`, () => {
    const queries = compileNodeQueries({
      schema,
      gatsbyNodeTypes: [nodeTypes.Foo, nodeTypes.Bar],
      customFragments: [`fragment Bar on Bar { foo { enum } }`],
    })

    expect(printQuery(queries, `Bar`)).toEqual(dedent`
      query LIST_Bar {
        allBar {
          remoteTypeName: __typename
          ...BarId
          ...Bar
        }
      }
      fragment BarId on Bar { testId }
      fragment Bar on Bar {
        foo {
          remoteTypeName: __typename
          testId
        }
      }
    `)
  })

  it(`extracts node fields declared on other node type to separate fragments`, () => {
    const queries = compileNodeQueries({
      schema,
      gatsbyNodeTypes: [nodeTypes.Foo, nodeTypes.Bar],
      customFragments: [
        `fragment Foo on Foo { string }`,
        `fragment Bar1 on Bar { bar foo { enum } }`,
        `fragment Bar2 on Bar { foo { int } }`,
      ],
    })

    expect(queries.size).toEqual(2)
    expect(printQuery(queries, `Foo`)).toEqual(dedent`
      query LIST_Foo {
        allFoo {
          remoteTypeName: __typename
          ...FooId
          ...Foo
          ...Bar1__foo
          ...Bar2__foo
        }
      }
      
      fragment FooId on Foo { testId }
      fragment Foo on Foo { string }
      fragment Bar1__foo on Foo { enum }
      fragment Bar2__foo on Foo { int }
    `)
    expect(printQuery(queries, `Bar`)).toEqual(dedent`
      query LIST_Bar {
        allBar {
          remoteTypeName: __typename
          ...BarId
          ...Bar1
          ...Bar2
        }
      }
      
      fragment BarId on Bar { testId }
      fragment Bar1 on Bar {
        bar
        foo {
          remoteTypeName: __typename
          testId
        }
      }
      fragment Bar2 on Bar {
        foo {
          remoteTypeName: __typename
          testId
        }
      }
    `)
  })

  it(`preserves nested non-node fields`, () => {
    const fragment = `
      fragment Bar on Bar {
        bar
        foo {
          enum
          int
        }
      }
    `
    const queries = compileNodeQueries({
      schema,
      gatsbyNodeTypes: [nodeTypes.Bar],
      customFragments: [fragment],
    })

    expect(queries.size).toEqual(1)
    expect(printQuery(queries, `Bar`)).toEqual(dedent`
      query LIST_Bar {
        allBar {
          remoteTypeName: __typename
          ...BarId
          ...Bar
        }
      }

      fragment BarId on Bar {
        testId
      }

      fragment Bar on Bar {
        bar
        foo {
          enum
          int
        }
      }
    `)
  })

  it(`aliases internal Gatsby fields`, () => {
    const fragment = `
      fragment WithGatsbyFields on WithGatsbyFields {
        id
        internal
        parent
        children
        fields {
          id
          internal
          parent
          children
        }
      }
    `
    const queries = compileNodeQueries({
      schema,
      gatsbyNodeTypes: [nodeTypes.WithGatsbyFields],
      customFragments: [fragment],
    })

    expect(queries.size).toEqual(1)
    expect(printQuery(queries, `WithGatsbyFields`)).toEqual(dedent`
      query LIST_WithGatsbyFields {
        allWithGatsbyFields {
          remoteTypeName: __typename
          ...WithGatsbyFieldsId
          ...WithGatsbyFields
        }
      }
      
      fragment WithGatsbyFieldsId on WithGatsbyFields {
        remoteTypeName: __typename
        remoteId: id
      }

      fragment WithGatsbyFields on WithGatsbyFields {
        remoteId: id
        remoteInternal: internal
        remoteParent: parent
        remoteChildren: children
        remoteFields: fields {
          remoteId: id
          remoteInternal: internal
          remoteParent: parent
          remoteChildren: children
        }
      }
    `)
  })

  it.todo(`supports complex ID fields`)
  it.todo(`adds remoteTypeName field`)
})

describe(`Schema with abstract types`, () => {})

describe(`Variables`, () => {
  it.todo(`adds variable declarations automatically`)
  it.todo(`supports complex input variables`)
})

function printQuery(
  compiledQueries: Map<RemoteTypeName, DocumentNode>,
  remoteTypeName: string
) {
  const query = compiledQueries.get(remoteTypeName)
  if (!query) {
    throw new Error(`Query for ${remoteTypeName} was not compiled`)
  }
  return print(query).replace(/\n$/, ``)
}

function dedent(gqlStrings) {
  return print(parse(gqlStrings[0])).replace(/\n$/, ``)
}
