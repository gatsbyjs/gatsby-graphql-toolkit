import { buildSchema } from "graphql"
import { dedent, printFragment } from "../../__tests__/test-utils"
import { IGatsbyNodeConfig } from "../../types"
import { compileGatsbyFragments } from "../compile-gatsby-fragments"

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
  type Foo implements Node {
    testId: ID
    string: String
    int: Int
    float: Float
    enum: FooBarEnum
    withWrappers: [String!]!
    createdAt: Int
    updatedAt: Int
    bars(page: Page): BarConnection
    stringWithArg(foo: String): String
  }
  type Bar implements Node & WithFoo {
    testId: ID
    foo: Foo
    node: Node
    nodeList: [Node!]!
    bar: String
    createdAt: Int
    updatedAt: Int
  }
  type BarConnection {
    nodes: [Bar]
  }
  input Page {
    pageNumber: Int
    perPage: Int
  }
  type Query {
    allFoo(limit: Int = 10 offset: Int = 0): [Foo]
    allBar(page: Page): BarConnection
  }
`)

const nodeTypes: {
  Foo: IGatsbyNodeConfig
  Bar: IGatsbyNodeConfig
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

it(`prefixes type names in fragment type condition`, () => {
  const fragments = compileGatsbyFragments({
    schema,
    gatsbyNodeTypes: [nodeTypes.Foo],
    gatsbyTypePrefix: `Test`,
    customFragments: [`fragment Foo on Foo { string }`],
  })

  expect(fragments.definitions.length).toEqual(1)
  expect(printFragment(fragments, `Foo`)).toEqual(dedent`
    fragment Foo on TestFoo {
      string
    }
  `)
})

it(`prefixes type names in inline fragment type condition`, () => {
  const fragments = compileGatsbyFragments({
    schema,
    gatsbyNodeTypes: [nodeTypes.Foo, nodeTypes.Bar],
    gatsbyTypePrefix: `Test`,
    customFragments: [
      `fragment Foo on Node {
        ... on Foo { string }
        ... on Bar {
          bar
          foo {
            ... on Foo { enum }
          }
        }
      }
      `,
    ],
  })

  expect(fragments.definitions.length).toEqual(1)
  expect(printFragment(fragments, `Foo`)).toEqual(dedent`
    fragment Foo on TestNode {
      ... on TestFoo { string }
      ... on TestBar {
        bar
        foo {
          ... on TestFoo { enum }
        }
      }
    }
  `)
})

it(`prefixes connection type names`, () => {
  const fragments = compileGatsbyFragments({
    schema,
    gatsbyNodeTypes: [nodeTypes.Foo, nodeTypes.Bar],
    gatsbyTypePrefix: `Test`,
    customFragments: [
      `fragment Foo on Foo { bars { ... on BarConnection { string } } }`,
      `fragment Bar on BarConnection { nodes { string } }`,
    ],
  })

  expect(fragments.definitions.length).toEqual(2)
  expect(printFragment(fragments, `Bar`)).toEqual(dedent`
    fragment Bar on TestBarConnection_Remote {
      nodes { string }
    }
  `)
  expect(printFragment(fragments, `Foo`)).toEqual(dedent`
    fragment Foo on TestFoo {
      bars { ... on TestBarConnection_Remote { string } }
    }
  `)
})

it(`uses aliases as field names`, () => {
  const fragments = compileGatsbyFragments({
    schema,
    gatsbyNodeTypes: [nodeTypes.Foo, nodeTypes.Bar],
    gatsbyTypePrefix: `Test`,
    customFragments: [
      `
        fragment Foo on Foo {
          myString: string
          myBars: bars {
            myNodes: nodes {
              myBarString: bar
            }
          }
        }
        fragment Bar on Bar {
          myNode: node {
            ... on Foo {
              myString: string
            }
            ... on Bar {
              myBar: bar
            }
          }
        }
      `,
    ],
  })

  expect(fragments.definitions.length).toEqual(2)
  expect(printFragment(fragments, `Foo`)).toEqual(dedent`
    fragment Foo on TestFoo {
      myString
      myBars {
        myNodes {
          myBarString
        }
      }
    }
  `)
  expect(printFragment(fragments, `Bar`)).toEqual(dedent`
    fragment Bar on TestBar {
      myNode {
        ... on TestFoo { myString }
        ... on TestBar { myBar }
      }
    }
  `)
})

it(`strips field arguments`, () => {
  const fragments = compileGatsbyFragments({
    schema,
    gatsbyNodeTypes: [nodeTypes.Foo],
    gatsbyTypePrefix: `Test`,
    customFragments: [
      `
      fragment Foo on Foo {
        bars(page: { pageNumber: 2 }) {
          string
        }
      }
    `,
    ],
  })

  expect(fragments.definitions.length).toEqual(1)
  expect(printFragment(fragments, `Foo`)).toEqual(dedent`
    fragment Foo on TestFoo {
      bars { string }
    }
  `)
})

it(`strips non-standard directives`, () => {
  const fragments = compileGatsbyFragments({
    schema,
    gatsbyNodeTypes: [nodeTypes.Foo],
    gatsbyTypePrefix: `Test`,
    customFragments: [
      `
      fragment Foo on Foo @myFragmentDirective {
        bars @myFieldDirective {
          string
        }
      }
    `,
    ],
  })

  expect(fragments.definitions.length).toEqual(1)
  expect(printFragment(fragments, `Foo`)).toEqual(dedent`
    fragment Foo on TestFoo {
      bars {
        string
      }
    }
  `)
})

it(`preserves standard directives`, () => {
  const fragments = compileGatsbyFragments({
    schema,
    gatsbyNodeTypes: [nodeTypes.Foo],
    gatsbyTypePrefix: `Test`,
    customFragments: [
      `
      fragment Foo on Foo @include(if: false) {
        bars @skip(if: false) {
          string
        }
      }
    `,
    ],
  })

  expect(fragments.definitions.length).toEqual(1)
  expect(printFragment(fragments, `Foo`)).toEqual(dedent`
    fragment Foo on TestFoo @include(if: false) {
      bars @skip(if: false) {
        string
      }
    }
  `)
})

it.todo(`preserves variables within fragments?`)
it.todo(`preserves pagination arguments?`)
