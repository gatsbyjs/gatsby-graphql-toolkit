import { parse, print, buildSchema, DocumentNode } from "graphql"
import { compileNodeQueries } from "../compile-node-queries"
import { IGatsbyNodeConfig, RemoteTypeName } from "../../types"

describe(`Happy path`, () => {
  const schema = buildSchema(`
    enum FooBarEnum {
      FOO
      BAR
    }
    interface Node {
      testId: ID
      createdAt: Int
      updatedAt: Int
    }
    interface WithFoo {
      testId: ID
      foo: Foo
    }
    interface WithNode {
      node: Node
    }
    type Foo implements Node {
      testId: ID
      string: String
      int: Int
      float: Float
      enum: FooBarEnum
      withWrappers: [String!]!
      createdAt: Int
      updatedAt: Int
    }
    type Bar implements Node & WithFoo & WithNode {
      testId: ID
      foo: Foo
      node: Node
      bar: String
      createdAt: Int
      updatedAt: Int
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
    type ComplexId {
      kind: String
      uid: String
    }
    type WithComplexId1 {
      id: ComplexId
      withComplexId2: WithComplexId2
    }
    type WithComplexId2 {
      testId: String
      id: ComplexId
      withComplexId1: WithComplexId1
    }
    input Page {
      pageNumber: Int
      perPage: Int
    }
    type Query {
      allFoo(limit: Int = 10 offset: Int = 0): [Foo]
      allBar(page: Page): [Bar]
      allGatsbyFields: [GatsbyFields]
      allWithGatsbyFields: [WithGatsbyFields]
      allWithComplexId1: [WithComplexId1]
      allWithComplexId2: [WithComplexId2]
    }
  `)

  const nodeTypes: {
    Foo: IGatsbyNodeConfig
    Bar: IGatsbyNodeConfig
    WithGatsbyFields: IGatsbyNodeConfig
    GatsbyFields: IGatsbyNodeConfig
    WithComplexId1: IGatsbyNodeConfig
    WithComplexId2: IGatsbyNodeConfig
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
    GatsbyFields: {
      remoteTypeName: `GatsbyFields`,
      queries: `
        query LIST_GatsbyFields { allGatsbyFields { ...GatsbyFieldsId } }
        fragment GatsbyFieldsId on GatsbyFields { id }
      `,
    },
    WithGatsbyFields: {
      remoteTypeName: `WithGatsbyFields`,
      queries: `
        query LIST_WithGatsbyFields { allWithGatsbyFields { ...WithGatsbyFieldsId } }
        fragment WithGatsbyFieldsId on WithGatsbyFields { __typename id }
      `,
    },
    WithComplexId1: {
      remoteTypeName: `WithComplexId1`,
      queries: `
        query LIST_WithComplexId1 { allWithComplexId1 { ...WithComplexId1_Id } }
        fragment WithComplexId1_Id on WithComplexId1 { id { kind uid } }
      `,
    },
    WithComplexId2: {
      remoteTypeName: `WithComplexId2`,
      queries: `
        query LIST_WithComplexId2 { allWithComplexId2 { ...WithComplexId2_Id } }
        fragment WithComplexId2_Id on WithComplexId2 { testId id { uid } }
      `,
    },
  }

  it(`adds __typename in the top-level node field`, () => {
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

  it(`replaces other node selections with reference`, () => {
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

  it(`aliases internal Gatsby fields on node types`, () => {
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
      gatsbyNodeTypes: [nodeTypes.WithGatsbyFields, nodeTypes.GatsbyFields],
      customFragments: [fragment],
    })

    expect(queries.size).toEqual(2)
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
          remoteTypeName: __typename
          remoteId: id
        }
      }
    `)
    expect(printQuery(queries, `GatsbyFields`)).toEqual(dedent`
      query LIST_GatsbyFields {
        allGatsbyFields {
          remoteTypeName: __typename
          ...GatsbyFieldsId
          ...WithGatsbyFields__fields
        }
      }
      
      fragment GatsbyFieldsId on GatsbyFields {
        remoteId: id
      }
      
      fragment WithGatsbyFields__fields on GatsbyFields {
        remoteId: id
        remoteInternal: internal
        remoteParent: parent
        remoteChildren: children
      }
    `)
  })

  it(`doesn't alias internal Gatsby fields on non-node types`, () => {
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
          id
          internal
          parent
          children
        }
      }
    `)
  })

  it(`supports complex ID fields`, () => {
    const queries = compileNodeQueries({
      schema,
      gatsbyNodeTypes: [nodeTypes.WithComplexId1, nodeTypes.WithComplexId2],
      customFragments: [
        `
          fragment Foo on WithComplexId1 {
            withComplexId2 { testId }
          }
        `,
        `
          fragment Bar on WithComplexId2 {
            withComplexId1 { id { uid } }
          }
        `,
      ],
    })

    expect(queries.size).toEqual(2)
    expect(printQuery(queries, `WithComplexId1`)).toEqual(dedent`
      query LIST_WithComplexId1 {
        allWithComplexId1 {
          remoteTypeName: __typename
          ...WithComplexId1_Id
          ...Foo
          ...Bar__withComplexId1
        }
      }
      
      fragment WithComplexId1_Id on WithComplexId1 {
        remoteId: id {
          kind
          uid
        }
      }
      
      fragment Foo on WithComplexId1 {
        withComplexId2 {
          remoteTypeName: __typename
          testId
          remoteId: id {
            uid
          }
        }
      }
      
      fragment Bar__withComplexId1 on WithComplexId1 {
        remoteId: id {
          uid
        }
      }
    `)
    expect(printQuery(queries, `WithComplexId2`)).toEqual(dedent`
      query LIST_WithComplexId2 {
        allWithComplexId2 {
          remoteTypeName: __typename
          ...WithComplexId2_Id
          ...Foo__withComplexId2
          ...Bar
        }
      }
      
      fragment WithComplexId2_Id on WithComplexId2 {
        testId
        remoteId: id {
          uid
        }
      }
      
      fragment Foo__withComplexId2 on WithComplexId2 {
        testId
      }

      fragment Bar on WithComplexId2 {
        withComplexId1 {
          remoteTypeName: __typename
          remoteId: id {
            kind
            uid
          }
        }
      }
    `)
  })

  describe(`Abstract types`, () => {
    it(`includes fragments on interface type to source queries of all implementing nodes`, () => {
      const queries = compileNodeQueries({
        schema,
        gatsbyNodeTypes: [nodeTypes.Foo, nodeTypes.Bar],
        customFragments: [
          `
            fragment NodeFragment on Node {
              createdAt
            }
          `,
        ],
      })

      expect(queries.size).toEqual(2)
      expect(printQuery(queries, `Foo`)).toEqual(dedent`
        query LIST_Foo {
          allFoo {
            remoteTypeName: __typename
            ...FooId
            ...NodeFragment
          }
        }
        fragment FooId on Foo {
          testId
        }
        fragment NodeFragment on Node {
          createdAt
        }
      `)
      expect(printQuery(queries, `Bar`)).toEqual(dedent`
        query LIST_Bar {
          allBar {
            remoteTypeName: __typename
            ...BarId
            ...NodeFragment
          }
        }
        fragment BarId on Bar {
          testId
        }
        fragment NodeFragment on Node {
          createdAt
        }
      `)
    })

    it(`replaces other node selections with reference within interface fragments`, () => {
      const queries = compileNodeQueries({
        schema,
        gatsbyNodeTypes: [nodeTypes.Foo, nodeTypes.Bar],
        customFragments: [
          `
            fragment FooFragment on WithFoo {
              foo {
                enum
              }
            }
            fragment NodeFragment on WithNode {
              node {
                createdAt
              }
            }
          `,
        ],
      })
      expect(printQuery(queries, `Bar`)).toEqual(dedent`
        query LIST_Bar {
          allBar {
            remoteTypeName: __typename
            ...BarId
            ...NodeFragment__node
            ...FooFragment
            ...NodeFragment
          }
        }
        fragment BarId on Bar {
          testId
        }
        fragment NodeFragment__node on Node {
          createdAt
        }
        fragment FooFragment on WithFoo {
          foo {
            remoteTypeName: __typename
            testId
          }
        }
        fragment NodeFragment on WithNode {
          node {
            remoteTypeName: __typename
            testId
          }
        }
      `)
    })
  })

  describe(`Variables`, () => {
    it(`adds variable declarations automatically`, () => {
      const queries = compileNodeQueries({
        schema,
        gatsbyNodeTypes: [
          {
            remoteTypeName: `Foo`,
            queries: `
              query LIST_Foo { allFoo(limit: $limit offset: $offset) { ...FooId } }
              fragment FooId on Foo { testId }
            `,
          },
        ],
        customFragments: [
          `fragment Foo on Foo { createdAt }`
        ]
      })

      expect(queries.size).toEqual(1)
      expect(printQuery(queries, `Foo`)).toEqual(dedent`
        query LIST_Foo($limit: Int, $offset: Int) {
          allFoo(limit: $limit, offset: $offset) {
            remoteTypeName: __typename
            ...FooId
            ...Foo
          }
        }
        
        fragment FooId on Foo {
          testId
        }
        
        fragment Foo on Foo {
          createdAt
        }
      `)
    })
    it(`supports complex input variables`, () => {
      const queries = compileNodeQueries({
        schema,
        gatsbyNodeTypes: [
          {
            remoteTypeName: `Bar`,
            queries: `
              query LIST_Bar { allBar(page: $page) { ...BarId } }
              fragment BarId on Bar { testId }
            `,
          },
        ],
        customFragments: [
          `fragment Bar on Bar { createdAt }`
        ]
      })

      expect(queries.size).toEqual(1)
      expect(printQuery(queries, `Bar`)).toEqual(dedent`
        query LIST_Bar($page: Page) {
          allBar(page: $page) {
            remoteTypeName: __typename
            ...BarId
            ...Bar
          }
        }
        fragment BarId on Bar {
          testId
        }
        fragment Bar on Bar {
          createdAt
        }
      `)
    })
  })
})

describe(`Errors`, () => {
  // TODO
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
