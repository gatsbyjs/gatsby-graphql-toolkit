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

- Source only what's needed
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
  description(truncateAt: Int): String
  author: Author
}

type Author {
  id: ID!
  name: String
  allPosts: [Post]
}

type Query {
  author(id: ID!): Author
  authors(limit: Int = 10, offset: Int = 0): [Author]
  post(id: ID!): Post
  posts(limit: Int = 10, offset: Int = 0): [Post]
}
```

Let's suppose it is available via the following endpoint: `https://www.example.com/graphql`.

How do we source data from this GraphQL API using the toolkit?

```js
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
      remoteTypeName: `Author`,
      remoteIdFields: [`__typename`, `id`],
      queries: `query LIST_AUTHORS { authors(limit: $limit, offset: $offset) }`,
    },
  ]

  // Step3. Provide (or generate) fragments with fields to be fetched
  const fragments = generateDefaultFragments({ schema, gatsbyNodeTypes })

  // Step4. Compile sourcing queries
  const documents = compileNodeQueries({
    schema,
    gatsbyNodeTypes,
    customFragments: fragments,
  })

  return {
    gatsbyApi,
    schema,
    execute,
    gatsbyTypePrefix: `Example`,
    gatsbyNodeDefs: buildNodeDefinitions({ gatsbyNodeTypes, documents }),
  }
}

exports.sourceNodes = async (gatsbyApi, pluginOptions) => {
  const config = await createSourcingConfig(gatsbyApi)

  // Step5. Merge remote types into Gatsby Schema
  await createSchemaCustomization(config)

  // Step6. Source nodes
  await sourceAllNodes(config)
}
```

### Essential steps

Let's take a closer look at essential steps in this example

#### 1. Setup remote schema

```js
const execute = createDefaultQueryExecutor(`https://www.example.com/graphql`)
const schema = await loadSchema(execute)
```

The toolkit executes GraphQL queries against remote API and so expects you
to provide `execute` function for that. A default implementation is available via
[`createDefaultQueryExecutor`](#createdefaultqueryexecutor) utility.

Also, we are going to perform various kinds of analysis with GraphQL schema and so
expect a `schema` object (an instance of `GraphQLSchema` from `graphql-js` package).

Use [`loadSchema`](#loadschema) to fetch the remote schema and re-construct it locally via GraphQL [introspection][5].

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

Declare which types of the remote GraphQL API will be treated as Gatsby nodes
and provide the necessary configuration for node sourcing and schema customization.

Settings explained:

- `remoteTypeName` is utilized to:
  - Build gatsby node type name as follows: `${gatsbyTypePrefix}${remoteTypeName}` ([customizable](TODOC)).
  - Discover and resolve relationships between node types in the schema.

- `remoteIdFields` are necessary to:
  - Construct gatsby node id (a concatenation of all remote id fields)
  - Re-fetch individual nodes by `id` (e.g. to support previews and delta sourcing)
  - Resolve node relationships in Gatsby schema customization

- `queries` for node sourcing (without field selections).
  Those are combined with custom fragments for actual data fetching (see the next 2 steps) .

  Query definitions must conform to [several conventions](#source-query-conventions) and enable:

  - Full sourcing with [pagination](#pagination-and-sourcing)
  - Partial sourcing (using multiple `LIST` queries with different filters)
  - Node re-fetching (for [previews and delta sourcing](TODOC))

#### 3. Define fields to be fetched (using GraphQL fragments)

This step is probably the most important for the whole process.
It enables different workflows with high granularity of sourcing.

In the example we demonstrate the simplest workflow - [automatic fragments generation](#generatedefaultfragments)
on each run:

```js
const fragments = generateDefaultFragments({ schema, gatsbyNodeTypes })
```

This call generates the following fragments ([customizable](#generatedefaultfragments)):

```graphql
fragment Post on Post {
  id
  description
  author {
    id
  }
}

fragment Author on Author {
  id
  name
  allPosts {
    id
  }
}
```

In [step 4](#4-compile-sourcing-queries) we combine those fragments with `queries` (from [step 2](#2-configure-gatsby-node-types))
to produce final sourcing queries.

---
But instead of generating them, you could have provided them yourself.
You could have chosen the following workflow (as one of the possible options):

 1. Generate fragments on the very first run and save them somewhere in the `src` folder
 2. Allow developers to edit those fragments in IDE (e.g. to remove fields they don't need, add [fields with arguments](TODOC), etc)
 3. Load modified fragments from the file system on each run

This step leaves you enough space in organizing sourcing that is suitable for your specific case.

---

For example let's modify the `Author` fragment to fetch excerpts of author posts:

```graphql
fragment CustomizedAuthorFragment on Author {
  id
  name
  allPosts {
    excerpt: description(truncateAt: 200)
  }
}
```

We will see how this change affects sourcing queries in the next step. 

#### 4. Compile sourcing queries

In this step we combine node configurations with custom fragments and compile final queries for node sourcing:

```js
const documents = compileNodeQueries({
  schema,
  gatsbyNodeTypes,
  customFragments: fragments,
})
```

For our example the toolkit will compile two documents (for `Post` and `Author` types respectively):

`Post`:

```graphql
query LIST_POSTS($limit: Int, $offset: Int) {
  posts(limit: $limit, offset: $offset) {
    remoteTypeName: __typename
    remoteId: id
    ...Post
    ...CustomizedAuthorFragment__allPosts
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

fragment CustomizedAuthorFragment__allPosts on Post {
  excerpt: description(truncateAt: 200)
}
```

`Author`:

```graphql
query LIST_AUTHORS($limit: Int, $offset: Int) {
  authors(limit: $limit, offset: $offset) {
    remoteTypeName: __typename
    remoteId: id
    ...CustomizedAuthorFragment
  }
}

fragment CustomizedAuthorFragment on Author {
  remoteId: id
  name
  allPosts {
    # Notice how the `excerpt` field was moved to the `Post` document
    # and fields listed in the `remoteIdFields` setting added (to resolve the relation later)
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

#### 5. Merge remote types into Gatsby Schema

This step utilizes Gatsby [Schema Customization API][6] to describe node types specified in [step 2](#2-configure-gatsby-node-types).
 
For our example the toolkit creates the following Gatsby node type definitions:

```graphql
type ExamplePost implements Node @dontInfer {
  id: ID!
  description: String
  excerpt: String
  author: ExampleAuthor
}

type ExampleAuthor implements Node @dontInfer {
  id: ID!
  name: String
  allPosts: [ExamplePost]
}
```
(as well as custom resolvers for `ExamplePost.author` and `ExampleAuthor.allPosts` to resolve relationships)

The toolkit uses remote schema as a reference, but it doesn't clone it 1 to 1.

In fact, it takes all the fields from the sourcing query (including aliased fields)
and adds them to Gatsby node type with slight changes:

 - type of the field stays semantically the same as in the remote schema
 - every type name is prefixed with `gatsbyTypePrefix` setting (`Post` => `ExamplePost` in our case)
 - all field arguments are removed
 
---
**Why?** The primary motivation for this approach is to support arbitrary field arguments of
the remote schema.

In general the following field definition: `field(arg: Int!)` can't be directly copied
from the remote schema unless we know all usages of `arg` during Gatsby build.

To workaround this problem we require you to provide those usages in your fragments as
aliased fields:

fragment MyFragment on RemoteType {
  alias1: field(arg: 1)
  alias2: field(arg: 2)
}

And then we add those `alias1` and `alias2` fields to Gatsby type so that you could access
them in Gatsby queries.
---

#### 6. Source nodes

Here we execute all the queries compiled in [step 4](#4-compile-sourcing-queries) against the remote GraphQL API
and then transform results to Gatsby nodes using [createNode API](https://www.gatsbyjs.org/docs/actions/#createNode).

Let's take another look at one of the queries:

```graphql
query LIST_AUTHORS($limit: Int, $offset: Int) {
  authors(limit: $limit, offset: $offset) {
    remoteTypeName: __typename
    remoteId: id
    ...CustomizedAuthorFragment
  }
}

fragment CustomizedAuthorFragment on Author {
  remoteId: id
  name
  allPosts {
    remoteTypeName: __typename
    remoteId: id
  }
}
```

The query has `$limit` and `$offset` variables for pagination (defined in [step 2](#2-configure-gatsby-node-types)).
The toolkit uses variable names to resolve an effective [pagination strategy](#pagination-and-sourcing) which
"knows" how to perform pagination.

In our case it is `LimitOffset` strategy that provides values for `$limit` and `$offset` variables as the toolkit
loops through pages (you can also define a [custom strategy](#custom-pagination-strategy)).

### Sourcing changes (delta)
TODOC

### Source Query Conventions
TODOC

### Pagination and sourcing

[Pagination][7] is essential for an effective node sourcing. But different GraphQL APIs
implement pagination differently. The toolkit abstracts those differences away by
introducing a concept of "pagination strategy".

Two most common strategies supported out of the box: `LimitOffset` and `RelayForward`.
But you can also [define a custom one](#custom-pagination-strategy).

The toolkit selects which strategy to use based on variable names used in the query:

- `LimitOffset`: when it sees `$limit` and `$offset` variables in the query
- `RelayForward`: when it sees `$before` and `$start` variables in the query

In a nutshell pagination strategy simply "knows" which variable values to use for the
given GraphQL query to fetch the next page of a field.

#### RelayForward
#### Custom Pagination Strategy
TODOC

## Debugging

TODOC

## Tools Reference

#### createDefaultQueryExecutor
#### loadSchema
#### generateDefaultFragments



## TODO:

- [ ] Mime-type mapping on nodes
- [ ] Ignore deleted nodes when resolving references
- [ ] Allow custom variables in schema customization?
- [ ] Tool: `fetchMissingReferences` fetch missing nodes for existing references
- [ ] Tool: compile Gatsby fragments from remote GraphQL API fragments
- [ ] Tool: auto-configuration for Relay-compliant GraphQL schemas 

[0]: https://www.gatsbyjs.org/tutorial/source-plugin-tutorial/
[1]: https://www.gatsbyjs.org/docs/creating-a-source-plugin/#sourcing-data-and-creating-nodes
[2]: https://github.com/gatsbyjs/gatsby/issues/15906
[3]: https://www.gatsbyjs.com/preview/
[4]: https://www.gatsbyjs.com/docs/incremental-builds/
[5]: https://graphql.org/learn/introspection/
[6]: https://www.gatsbyjs.org/docs/schema-customization/
[7]: https://graphql.org/learn/pagination/
[8]: https://graphql.org/learn/queries/#meta-fields
