# Gatsby GraphQL Source Toolkit

The toolkit is designed to simplify data sourcing from the remote GraphQL API into Gatsby.

Note: this is **not** a source plugin by itself, but it helps [writing custom GraphQL source plugins][0]
by providing a set of convenience tools and conventions.

## Why not `gatsby-source-graphql`

Historically Gatsby suggested `gatsby-source-graphql` plugin to consume data from remote GraphQL APIs.

This plugin is easy to use, but it has a major problem: it doesn’t adhere to the original
Gatsby architecture (doesn’t [source nodes][1]) which makes data caching impossible.
As a result, it doesn’t scale well, and can’t work with Gatsby Preview or Incremental Builds by design
([more technical details][2]).

Also, with `gatsby-source-graphql` you can't leverage the power of Gatsby transformer plugins like `gatsby-transformer-remark`
or `gatsby-transformer-sharp` (and it's hard to use with `gatsby-image` as a consequence).

This new toolkit should solve all those issues and implement true node sourcing for Gatsby.

## Features

- Source only what's needed (using fragments)
- Efficient concurrent data fetching
- Automatic pagination
- Cache data between runs (source changes only)
- Schema customization out of the box (no performance penalty from type inference)
- Designed to support [Gatsby Preview][3] and [Incremental Builds][4]

## How it works

Let's start with a very simple GraphQL schema as an example:

```graphql
type Post {
  id: ID!
  description: String
  author: User
}

type User {
  id: ID!
  name: String
  allPosts: [Post]
}

type Query {
  posts(limit: Int = 10, offset: Int = 0): [Post]
  users(limit: Int = 10, offset: Int = 0): [User]
  post(id: ID!): Post
  user(id: ID!): User
}
```

Let's suppose it is available via the following endpoint: `https://www.example.com/graphql`.

How do we source data from this GraphQL API using the toolkit?

```js
// gatsby-node.js
const {
  sourceAllNodes,
  createSchemaCustomization,
  generateDefaultFragments,
  buildNodeDefinitions,
  createDefaultQueryExecutor,
  loadSchema,
} = require("gatsby-graphql-toolkit")

async function createSourcingConfig(gatsbyApi) {
  // Step1. Setup remote schema:
  const execute = createDefaultQueryExecutor(`https://www.example.com/graphql`)
  const schema = await loadSchema(execute)

  // Step2. Configure Gatsby node types
  const gatsbyNodeTypes = [
    {
      remoteTypeName: `Post`,
      remoteIdFields: [`__typename`, `id`],
      queries: `query LIST_POSTS { posts(limit: $limit, offset: $offset) }`,
    },
    {
      remoteTypeName: `User`,
      remoteIdFields: [`__typename`, `id`],
      queries: `query LIST_USERS { users(limit: $limit, offset: $offset) }`,
    },
  ]

  // Step3. Provide (or generate) fragments with fields to be fetched
  const fragments = generateDefaultFragments({ schema, gatsbyNodeTypes })

  // Step4. Compile sourcing queries
  const gatsbyNodeDefs = buildNodeDefinitions({
    schema,
    gatsbyNodeTypes,
    customFragments: fragments,
  })

  return {
    gatsbyApi,
    schema,
    execute,
    gatsbyTypePrefix: `MyAPI`,
    gatsbyNodeDefs,
  }
}

exports.sourceNodes = async (gatsbyApi, pluginOptions) => {
  const config = await createSourcingConfig(gatsbyApi)

  // Step4. Customize Gatsby Schema
  await createSchemaCustomization(config)

  // Step5. Source nodes
  await sourceAllNodes(config)
}
```

### Essential steps:

#### 1. Setup remote schema

```js
const execute = createDefaultQueryExecutor(`https://www.example.com/graphql`)
const schema = await loadSchema(execute)
```

The toolkit executes GraphQL queries against your remote API and so expects you
to provide `execute` function for that. A default implementation is available via
`createDefaultQueryExecutor` utility.

Also, we are going to perform various kinds of analysis with your GraphQL schema so you
are expected to provide a `schema` (an instance of `GraphQLSchema` from `graphql-js` package).

Use `loadSchema` utility for this purpose that leverages GraphQL [introspection][5] under the hood.

#### 2. Configure Gatsby node types

```js
const gatsbyNodeTypes = [
  {
    remoteTypeName: `Post`,
    remoteIdFields: [`__typename`, `id`],
    queries: `query LIST_POSTS { posts(limit: $limit, offset: $offset) }`,
  },
  // ... other nodes
]
```

Here we declare which types of the remote GraphQL API will be treated as Gatsby nodes
and provide the necessary configuration for Gatsby node sourcing and schema customization.

- The toolkit uses `remoteTypeName` to build gatsby node type name as follows:
  `${gatsbyTypePrefix}${remoteTypeName}` (can be customized).

- `remoteIdFields` are used for several purposes:

  - To construct gatsby node id (a concatenation of all remote id fields)
  - To re-fetch individual nodes by id (e.g. to support previews and delta sourcing)
  - To resolve node relationships in schema customization
  - To paginate nested node fields

- `queries` for node sourcing (but without field selections).
   Those are combined with fragments for actual data fetching (see the next 2 steps) .

  There can be multiple `LIST` queries for a single node type (with different filters),
  as well as an additional `NODE` query for re-fetching individual nodes by `id`
  (to support previews and delta sourcing)

  Query definitions must conform to [several conventions](#source-query-conventions).

#### 3. Define fields to be fetched using GraphQL fragments

This step is probably the most important for the whole process.
It enables different workflows and high level of sourcing customization.

In the example we demonstrate a simple workflow - automatic fragments generation
on each run:

```js
const fragments = generateDefaultFragments({ schema, gatsbyNodeTypes })
```

This call generates the following fragments:

```graphql
fragment Post on Post {
  id
  description
  author {
    id
  }
}

fragment User on User {
  id
  name
  allPosts {
    id
  }
}
```

Instead, you could provide a set of your own arbitrary fragments
(you can have multiple fragments on the same type.

One of the possible workflows is to:
 1. Generate fragments on the very first run and save them somewhere in `src` folder
 2. Allow developers to edit fragments in IDE
 3. Load modified fragments from the file system on each run

#### 4. Compile sourcing queries

```js
const gatsbyNodeDefs = buildNodeDefinitions({
  schema,
  gatsbyNodeTypes,
  customFragments: fragments,
})
```

Here we combine node configurations with custom fragments and compile final queries for nodes sourcing.
For our example the toolkit will compile two documents (for `Post` and `User` types respectively):

`Post`:
```graphql
query LIST_POSTS($limit: Int, $offset: Int) {
  posts(limit: $limit, offset: $offset) {
    remoteTypeName: __typename
    remoteId: id
    ...Post
  }
}
fragment Post on Post {
  remoteId: id
  description
  author {
    remoteTypeName: __typename
    remoteId: id
  }
}
```

`User`:

```graphql
query LIST_USERS($limit: Int, $offset: Int) {
  users(limit: $limit, offset: $offset) {
    remoteTypeName: __typename
    remoteId: id
    ...User
  }
}
fragment User on User {
  remoteId: id
  name
  allPosts {
    remoteTypeName: __typename
    remoteId: id
  }
}
```

Note the toolkit automatically adds field aliases for reserved gatsby fields (
`id`, `internal`, `parent`, `children` and [`__typename` meta field][8])

You can write these documents somewhere to disk to ease debugging
(generated queries are static and could be used manually to replicate the error).

See [Debugging](#debugging) for details.

### Sourcing changes (delta)

TODOC

### Source Query Conventions

TODOC

### Pagination and sourcing

TODOC

## Debugging

TODOC

## TODO:

- [ ] Mime-type mapping on nodes
- [ ] Compiling Gatsby fragments from remote GraphQL API fragments
- [ ] Quick configuration for Relay-compliant GraphQL schemas

[0]: https://www.gatsbyjs.org/tutorial/source-plugin-tutorial/
[1]: https://www.gatsbyjs.org/docs/creating-a-source-plugin/#sourcing-data-and-creating-nodes
[2]: https://github.com/gatsbyjs/gatsby/issues/15906
[3]: https://www.gatsbyjs.com/preview/
[4]: https://www.gatsbyjs.com/docs/incremental-builds/
[5]: https://graphql.org/learn/introspection/
[6]: https://www.gatsbyjs.org/docs/schema-customization/
[7]: https://relay.dev/docs/en/graphql-server-specification.html#object-identification
[8]: https://graphql.org/learn/queries/#meta-fields
