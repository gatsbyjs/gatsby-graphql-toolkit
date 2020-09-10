import { buildSchema } from "graphql"
import { dedent, printFragment } from "../../__tests__/test-utils"
import { IGatsbyNodeConfig } from "../../types"
import { compileGatsbyFragments } from "../compile-gatsby-fragments"

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
      nodeList: [Node!]!
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
      foo: String
    }
    type WithComplexId2 {
      testId: String
      id: ComplexId
      withComplexId1: WithComplexId1
      foo: String
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

  it(`works without custom fragments`, () => {
    const fragmentDoc = compileGatsbyFragments({
      schema,
      gatsbyTypePrefix: `Test!`,
      gatsbyNodeTypes: [nodeTypes.Foo, nodeTypes.Bar],
      customFragments: [],
    })

    expect(fragmentDoc.definitions.length).toEqual(0)
  })

  it(`works with a single custom fragment`, () => {
    const fragments = compileGatsbyFragments({
      schema,
      gatsbyNodeTypes: [nodeTypes.Foo],
      gatsbyTypePrefix: `Test`,
      customFragments: [
        `fragment Foo on Foo { string }`
      ],
    })

    expect(fragments.definitions.length).toEqual(1)
    expect(printFragment(fragments, `Foo`)).toEqual(dedent`
      fragment Foo on TestFoo {
        string
      }
    `)
  })
})
