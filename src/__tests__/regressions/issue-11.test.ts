import { buildSchema } from "graphql"
import { dedent, printQuery } from "../test-utils"
import { compileNodeQueries } from "../../compile-node-queries"

// See https://github.com/vladar/gatsby-graphql-toolkit/issues/11

const schema = buildSchema(`
  type Sys {
    id: ID!
  }
  type Foo {
    sys: Sys
    foo: String
    bar: [Bar]
  }
  type Bar {
    sys: Sys
    bar: String
  }
  type Query {
    fooNodes: [Foo]
    barNodes: [Bar]
  }
`)

const gatsbyNodeTypes = [
  {
    remoteTypeName: `Foo`,
    queries: `
      query LIST_Foo {
        fooNodes { ...FooId }
      }
      fragment FooId on Foo { __typename sys { id } }
    `,
  },
  {
    remoteTypeName: `Bar`,
    queries: `
      query LIST_Bar {
        barNodes { ...BarId }
      }
      fragment BarId on Bar { __typename sys { id } }
    `,
  },
]

it(`should remove redundant fragments`, async () => {
  const documents = await compileNodeQueries({
    schema,
    gatsbyNodeTypes,
    customFragments: [
      `fragment Foo on Foo {
        foo
        bar {
          sys {
            id
          }
        }
      }`
    ],
  })

  expect(printQuery(documents, `Bar`)).toEqual(dedent`
    query LIST_Bar {
      barNodes {
        remoteTypeName: __typename
        ...BarId
      }
    }

    fragment BarId on Bar {
      remoteTypeName: __typename
      sys {
        remoteTypeName: __typename
        id
      }
    }

    # This fragment is removed from the result:
    # fragment Foo__bar on Bar {
    #   sys {
    #     remoteTypeName: __typename
    #     id
    #   }
    # }
  `)
})
