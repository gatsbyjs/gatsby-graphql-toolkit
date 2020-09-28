import { buildSchema } from "graphql"
import { gatsbyApi } from "../test-utils"
import {
  buildNodeDefinitions,
  createSourcingContext,
  compileNodeQueries,
  fetchNodeById,
} from "../.."

// See https://github.com/vladar/gatsby-graphql-toolkit/issues/14

const schema = buildSchema(`
  type Foo {
    id: ID!
    foo: String
  }
  input FooInput {
    id: ID
  }
  type Query {
    allFoo(input: FooInput): [Foo]
  }
`)

const gatsbyNodeTypes = [
  {
    remoteTypeName: `Foo`,
    queries: `
      query NODE_FOO {
        allFoo(input: { id: $id }) { ..._FooId_ }
      }
      fragment _FooId_ on Foo { __typename id }
    `,
  },
]

const documents = compileNodeQueries({
  schema,
  gatsbyNodeTypes,
  customFragments: [],
})

const fooNode = {
  remoteTypeName: `Foo`,
  remoteId: `1`,
  foo: `fooString`,
}

it(`supports lists with a single item in a node query`, async () => {
  const context = createSourcingContext({
    schema,
    gatsbyNodeDefs: buildNodeDefinitions({ gatsbyNodeTypes, documents }),
    execute: async () => Promise.resolve({ data: { allFoo: [fooNode] } }),
    gatsbyApi,
    gatsbyTypePrefix: `Test`,
  })

  const fooId = {
    remoteTypeName: fooNode.remoteTypeName,
    remoteId: fooNode.remoteId,
  }
  // Without the fix it throws:
  //   Error: Value of the ID field "remoteTypeName" can't be nullish. Got object with keys: 0
  await expect(fetchNodeById(context, `Foo`, fooId)).resolves.toEqual(fooNode)
})
