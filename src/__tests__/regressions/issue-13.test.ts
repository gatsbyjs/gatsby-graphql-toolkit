import { buildSchema } from "graphql"
import { dedent, printQuery, gatsbyApi } from "../test-utils"
import {
  buildNodeDefinitions,
  createSourcingContext,
  compileNodeQueries,
  fetchNodeList,
  fetchNodeById,
  LimitOffset,
} from "../.."
import { IRemoteNode } from "../../types"

// See https://github.com/vladar/gatsby-graphql-toolkit/issues/13

const schema = buildSchema(`
  type Foo {
    id: ID!
    foo: String
  }
  input FooInput {
    id: ID
    limit: Int
    offset: Int
  }
  type Query {
    foo(input: FooInput): Foo
    allFoo(input: FooInput): [Foo]
  }
`)

const gatsbyNodeTypes = [
  {
    remoteTypeName: `Foo`,
    queries: `
      query LIST_FOO {
        allFoo(input: { limit: $limit offset: $offset }) { ..._FooId_ }
      }
      query NODE_FOO {
        foo(input: { id: $id }) { ..._FooId_ }
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

it(`adds variable declarations for variables within input objects`, async () => {
  expect(printQuery(documents, `Foo`)).toEqual(dedent`
    query LIST_FOO ($limit: Int $offset: Int) {
      allFoo(input: { limit: $limit, offset: $offset }) {
        remoteTypeName: __typename
        ..._FooId_
      }
    }

    query NODE_FOO ($id: ID) {
      foo(input: {id: $id}) {
        remoteTypeName: __typename
        ..._FooId_
      }
    }

    fragment _FooId_ on Foo {
      remoteTypeName: __typename
      remoteId: id
    }
  `)
})

it(`correctly detects field to paginate in list query`, async () => {
  const context = createSourcingContext({
    schema,
    gatsbyNodeDefs: buildNodeDefinitions({ gatsbyNodeTypes, documents }),
    execute: async () => Promise.resolve({ data: { allFoo: [fooNode] } }),
    gatsbyApi,
    gatsbyTypePrefix: `Test`,
    paginationAdapters: [LimitOffset],
  })

  const fetchNodes = async () => {
    const nodes: IRemoteNode[] = []
    for await (const node of fetchNodeList(context, `Foo`, `LIST_FOO`)) {
      nodes.push(node)
    }
    return nodes
  }

  // Without the fix it throws:
  // Cannot find field to paginate in the query LIST_FOO. Make sure you spread IDFragment in your source query:
  //  query LIST_FOO { field { ...IDFragment } }
  await expect(fetchNodes()).resolves.toEqual([fooNode])
})

it(`correctly detects node field in node query`, async () => {
  const context = createSourcingContext({
    schema,
    gatsbyNodeDefs: buildNodeDefinitions({ gatsbyNodeTypes, documents }),
    execute: async () => Promise.resolve({ data: { foo: fooNode } }),
    gatsbyApi,
    gatsbyTypePrefix: `Test`,
    paginationAdapters: [LimitOffset],
  })

  // Without the fix it throws:
  //   Value of the ID field "remoteTypeName" can't be nullish. Got object with keys: foo
  const fooId = {
    remoteTypeName: fooNode.remoteTypeName,
    remoteId: fooNode.remoteId,
  }
  await expect(fetchNodeById(context, `Foo`, fooId)).resolves.toEqual(fooNode)
})
