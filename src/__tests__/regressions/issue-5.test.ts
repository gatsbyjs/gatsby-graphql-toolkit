import { buildSchema } from "graphql"
import { dedent, printQuery } from "../test-utils"
import { compileNodeQueries } from "../../compile-node-queries"

// See https://github.com/vladar/gatsby-graphql-toolkit/issues/5

const schema = buildSchema(`
  type Foo {
    id: ID!
    foo: String
  }
  type Query {
    nodes: Foo
  }
`)

const gatsbyNodeTypes = [
  {
    remoteTypeName: `Foo`,
    queries: `
      fragment FooId on Foo { __typename id }
      query LIST_Foo {
        nodes { ...FooId }
      }
    `,
  },
]

it(`should spread fragments correctly when ID fragment is defined before the query`, async () => {
  const documents = await compileNodeQueries({
    schema,
    gatsbyNodeTypes,
    customFragments: [`fragment Foo on Foo { foo }`],
  })

  expect(printQuery(documents, `Foo`)).toEqual(dedent`
    fragment FooId on Foo {
      remoteTypeName: __typename
      remoteId: id
    }
    query LIST_Foo {
      nodes {
        remoteTypeName: __typename
        ...FooId
        ...Foo
      }
    }
    fragment Foo on Foo {
      foo
    }
  `)
})
