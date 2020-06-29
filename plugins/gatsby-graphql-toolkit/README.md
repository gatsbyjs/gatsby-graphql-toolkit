# Gatsby GraphQL Source Toolkit

The toolkit is designed to simplify data sourcing from the remote GraphQL API into Gatsby.

Note: this is **not** a source plugin by itself, but it helps [writing custom GraphQL source plugins][0]
by providing a set of convenience tools and conventions.

## Table of contents

- [Why not `gatsby-source-graphql`](#why-not-gatsby-source-graphql)
- [Features](#features)
- [How it works](#how-it-works)
  * [1. Setup remote schema](#1-setup-remote-schema)
  * [2. Configure Gatsby node types](#2-configure-gatsby-node-types)
  * [3. Define fields to be fetched (using GraphQL fragments)](#3-define-fields-to-be-fetched-using-graphql-fragments)
  * [4. Compile sourcing queries](#4-compile-sourcing-queries)
  * [5. Add explicit types to gatsby schema](#5-add-explicit-types-to-gatsby-schema)
  * [6. Source nodes](#6-source-nodes)
- [Sourcing changes (delta)](#sourcing-changes-delta)
- [Automatic Pagination Explained](#automatic-pagination-explained)
- [Configuration](#configuration)
  * [Query executor](#query-executor)
  * [Gatsby field aliases](#gatsby-field-aliases)
  * [Type name transformer](#type-name-transformer)
  * [Custom Pagination Adapter](#custom-pagination-adapter)
- [Debugging](#debugging)
- [Tools Reference](#tools-reference)
  * [Configuration Tools](#configuration-tools)
    + [createDefaultQueryExecutor](#createdefaultqueryexecutor)
    + [loadSchema](#loadschema)
    + [buildNodeDefinitions](#buildnodedefinitions)
  * [Query compilation tools](#query-compilation-tools)
    + [generateDefaultFragments](#generatedefaultfragments)
    + [compileNodeQueries](#compilenodequeries)
  * [Schema customization tools](#schema-customization-tools)
    + [createSchemaCustomization](#createschemacustomization)
  * [Source nodes tools](#source-nodes-tools)
    + [sourceAllNodes](#sourceallnodes)
    + [sourceNodeChanges](#sourcenodechanges)
    + [fetchAllNodes](#fetchallnodes)
    + [fetchNodeList](#fetchnodelist)
    + [fetchNodesById](#fetchnodesbyid)
    + [fetchNodeById](#fetchnodebyid)

## Why not `gatsby-source-graphql`?

Historically Gatsby suggested `gatsby-source-graphql` plugin to consume data from remote GraphQL APIs.

This plugin is easy to use, but it has a significant problem: it doesn't adhere to the original
Gatsby architecture (doesn't [source nodes][1]), which makes data caching impossible.
As a result, it doesn't scale well, and can't work with Gatsby Preview or Incremental Builds by design
([more technical details][2]).

Also, with `gatsby-source-graphql` you can't leverage the power of Gatsby transformer plugins like `gatsby-transformer-remark`
or `gatsby-transformer-sharp` (and it's hard to use with `gatsby-image` as a consequence).

This new toolkit should solve all those issues and implement correct node sourcing for Gatsby.

## Features

- Efficient concurrent data fetching
- Automatic data pagination
- Cache data between runs (supports sourcing changes only)
- Customize what is sourced
- Schema customization out of the box (no performance penalty of type inference)
- Designed to support [Gatsby Preview][3] and [Incremental Builds][4]

## How it works

Let's imagine we have a straightforward GraphQL API located at `https://www.example.com/graphql`.
This example API has the following schema:

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

How do we source data from this GraphQL API using the toolkit?
Let's look at the full example and then walk through it step-by-step.

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

  // Step5. Add explicit types to gatsby schema
  await createSchemaCustomization(config)

  // Step6. Source nodes
  await sourceAllNodes(config)
}
```

Let's take a closer look at every step in this example.

### 1. Setup remote schema

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

### 2. Configure Gatsby node types

```js
const gatsbyNodeTypes = [
  {
    remoteTypeName: `Post`,
    remoteIdFields: [`__typename`, `id`],
    queries: `query LIST_POSTS { posts(limit: $limit, offset: $offset) }`,
  },
  // ... other node types
]
```

Declare which types of the remote GraphQL API you will treat as Gatsby nodes and provide the necessary configuration for node sourcing and schema customization.

Settings explained:

- `remoteTypeName` is utilized to:
  - Build gatsby node type name as follows: `${gatsbyTypePrefix}${remoteTypeName}` ([customizable](TODOC)).
  - Discover and resolve relationships between node types in the schema.

- `remoteIdFields` are necessary to:
  - Construct gatsby node id (a concatenation of all remote id fields)
  - Re-fetch individual nodes by `id` (e.g., to support previews and delta sourcing)
  - Resolve node relationships in Gatsby schema customization

- `queries` for node sourcing (without field selections).
  Those are combined with custom fragments for actual data fetching (see the next two steps).

### 3. Define fields to be fetched (using GraphQL fragments)

This step is probably the most important for the whole process.
It enables different workflows with a high granularity of sourcing.

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

But instead of generating them every time, you could have chosen the following workflow (as one of the possible options):

 1. Generate fragments on the very first run and save them somewhere in the `src` folder
 2. Allow developers to edit those fragments in IDE (e.g., to remove fields they don't need, add fields with arguments, etc.)
 3. Load modified fragments from the file system on each run

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

### 4. Compile sourcing queries

In this step we combine node configurations ([step 2](#2-configure-gatsby-node-types))
with custom fragments ([step 3](#3-define-fields-to-be-fetched-using-graphql-fragments))
and compile final queries for node sourcing:

```js
const documents = compileNodeQueries({
  schema,
  gatsbyNodeTypes,
  customFragments: fragments,
})
```

For our example, the toolkit will compile two documents (for `Post` and `Author` types respectively):

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
    remoteTypeName: __typename
    remoteId: id
  }
}
```

Note how the `excerpt` field has been moved from `CustomizedAuthorFragment` to the 
`CustomizedAuthorFragment__allPosts` in the `Post` document
(and fields from `remoteIdFields` list have been added in its place).

Also, note the toolkit automatically adds field aliases for reserved gatsby fields
(`id`, `internal`, `parent`, `children` and [`__typename` meta field][8])

You can write these documents somewhere to disk to ease debugging
(generated queries are static and could be used manually to replicate the error).

See [Debugging](#debugging) for details.

### 5. Add explicit types to gatsby schema

```js
await createSchemaCustomization(config)
```

This step utilizes Gatsby [Schema Customization API][6] to describe node types specified in [step 2](#2-configure-gatsby-node-types).
 
For our example, the toolkit creates the following Gatsby node type definitions:

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
> as well as custom resolvers for `ExamplePost.author` and `ExampleAuthor.allPosts` to resolve relationships

As you may see, the toolkit uses the remote schema as a reference, but it doesn't clone it 1 to 1.

Instead, it takes all the fields from the sourcing query (including aliased fields)
and adds them to Gatsby node type with slight changes:

 - every type name is prefixed with `gatsbyTypePrefix` setting (`Post` => `ExamplePost` in our case)
 - all field arguments are removed
 - type of the field remains semantically the same as in the remote schema
 
---
**Why?** The primary motivation is to support arbitrary field arguments of the remote schema.

In general the following field definition: `field(arg: Int!)` can't be directly copied
from the remote schema unless we know all usages of `arg` during Gatsby build.

To workaround this problem we ask you to provide those usages in fragments as
aliased fields:

```graphql
fragment MyFragment on RemoteType {
  field(arg: 0)
  alias1: field(arg: 1)
  alias2: field(arg: 2)
}
```

Then we add those `alias1` and `alias2` fields to Gatsby type so that you could access
them in Gatsby's queries.

---

### 6. Source nodes

Here we take all the queries compiled in [step 4](#4-compile-sourcing-queries), execute them
against the remote GraphQL API and transform results to Gatsby nodes using [createNode API][9].

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
But where do we get values for those variables?

The toolkit uses variable names to resolve an effective [pagination adapter](#automatic-pagination-explained) which
"knows" how to perform pagination and produce values for those variables.

> In our example it is `LimitOffset` adapter that "knows" how to produce values for `$limit` and `$offset` variables as the toolkit
> loops through pages.

Let's assume we've received a GraphQL result that looks like this:

```json
{
  "authors": [
    {
      "remoteTypeName": "Author",
      "remoteId": "1",
      "name": "Jane",
      "allPosts": [
        { "remoteTypeName": "Post", "remoteId":  "1" },
        { "remoteTypeName": "Post", "remoteId":  "2" },
        { "remoteTypeName": "Post", "remoteId":  "3" }
      ]
    }
  ]
}
```

The toolkit will create a single Gatsby node of type `ExampleAuthor` out of it as-is.
The only difference is that it will add the `id` field and required Gatsby's `internal` fields
as described [in `createNode` docs][9].


## Sourcing changes (delta)

Delta sourcing allows you to keep data sourced in a previous build and fetch only what
has changed since then.

> **Note:** it is only possible if your API allows you to receive
> the list of nodes changed since the last build.

Let's see how it works with [our original example](#how-it-works). First, we need to
modify the config of Gatsby node types from the [step 2](#2-configure-gatsby-node-types)
to support individual node re-fetching:

```diff
const gatsbyNodeTypes = [
  {
    remoteTypeName: `Post`,
    remoteIdFields: [`__typename`, `id`],
-   queries: `query LIST_POSTS { posts(limit: $limit, offset: $offset) }`,
+   queries: `
+       query LIST_POSTS { posts(limit: $limit, offset: $offset) }
+       query NODE_POST { post(id: $id) }
+   `,
  },
  // ... other node types
]
```

When compiling queries on [step 4](#4-compile-sourcing-queries) the toolkit will spread
all of our fragments in both queries, so the shape of the node will be identical when
executing `LIST_POSTS` or `NODE_POST`.

Next, let's modify `sourceNodes` in `gatsby-node.js`:

```js
exports.sourceNodes = async (gatsbyApi, pluginOptions) => {
  const lastBuildTime = await gatsbyApi.cache.get(`LAST_BUILD_TIME`)
  const config = await createSourcingConfig(gatsbyApi)
  await createSchemaCustomization(config)

  if (lastBuildTime) {
    // Source delta changes
    const nodeEvents = await fetchNodeChanges(lastBuildTime)
    await sourceNodeChanges(config, { nodeEvents })
  } else {
    // Otherwise source everything from scratch as usual
    await sourceAllNodes(config)
  }
  await gatsbyApi.cache.set(`LAST_BUILD_TIME`, Date.now())
}
```

The part you will have to implement yourself here is `fetchNodeChanges`.
It should fetch changes from your API and return a list of events in a format the toolkit
understands:

```js
async function fetchNodeChanges(lastBuildTime) {
  // Here we simply return the list of changes but in the real project you will
  // have to fetch changes from your API and transform them to this format:
  return [
    {
      eventName: "DELETE",
      remoteTypeName: "Post",
      remoteId: { __typename: "Post", id: "1" },
    },
    {
      eventName: "UPDATE",
      remoteTypeName: "Post",
      remoteId: { __typename: "Post", id: "2" },
    },
  ]
}
```

As you can see, two kinds of events supported (and thus must be tracked by your backend): `DELETE` and `UPDATE`.

The toolkit only cares about remote IDs of the nodes that have changed:
 - for the `UPDATE` event it will re-fetch nodes individually using `NODE_POST` query we defined above
 - for the `DELETE` event, it will delete corresponding Gatsby nodes (without further requests to your API).

The `remoteId` field here must contain values for **all** of the `remoteIdFields`
defined in gatsby node config above (in this example: `__typename` and `id`).
They will be passed to the `NODE_POST` query as variables.

## Automatic Pagination Explained

[Pagination][7] is essential for an effective node sourcing. But different GraphQL APIs
implement pagination differently. The toolkit abstracts those differences away by
introducing a concept of "pagination adapter".

Two most common adapters supported out of the box: `LimitOffset` and `RelayForward`
(for [Relay Connections specification][10]).
But you can also [define a custom one](#custom-pagination-adapter).

The toolkit selects which adapter to use based on variable names used in the query:

- `LimitOffset`: when it sees `$limit` and `$offset` variables
- `RelayForward`: when it sees `$first` and `$after` variables

In a nutshell pagination adapter simply "knows" which variable values to use for the
given GraphQL query to fetch the next page of a field.

This way the toolkit can paginate your queries automatically and express the
result as `AsyncIterator` of your nodes for convenience and efficiency.

## Configuration

You can adjust some aspects of sourcing and schema customization by providing a config
object of the following structure (typescript flavour):

```ts
type RemoteTypeName = string

interface ISourcingConfig {
  gatsbyApi: NodePluginArgs
  schema: GraphQLSchema
  gatsbyNodeDefs: Map<RemoteTypeName, IGatsbyNodeDefinition>
  gatsbyTypePrefix: string
  execute: IQueryExecutor

  gatsbyFieldAliases?: { [field: string]: string }
  typeNameTransform?: ITypeNameTransform
  paginationAdapters?: IPaginationAdapter<any, any>[]
}

interface IGatsbyNodeDefinition {
  remoteTypeName: RemoteTypeName
  remoteIdFields: string[]
  document: DocumentNode
  nodeQueryVariables: (id: IRemoteId) => object
}
```

Gatsby node definition is constructed from the node type config ([step 2](#2-configure-gatsby-node-types))
and compiled queries ([step 4](#4-compile-sourcing-queries)) using [`buildNodeDefinitions`](#buildnodedefinitions)
utility.

### Query executor

You can control how the toolkit executes GraphQL queries by providing a custom `execute`
function:

```ts
interface ISourcingConfig {
  // ...
  execute: IQueryExecutor
  // ...
}

export interface IQueryExecutor {
  (args: IQueryExecutionArgs): Promise<ExecutionResult>
}

export interface IQueryExecutionArgs {
  query: string
  operationName: string
  variables: object
  document?: DocumentNode
}

interface ExecutionResult {
  errors?: ReadonlyArray<GraphQLError>;
  data?: object;
}
```

It can be as simple as this:

```js
const fetch = require("node-fetch")

async function execute({ operationName, query, variables = {} }) {
  const res = await fetch(`https://www.example.com/graphql`, {
    method: "POST",
    body: JSON.stringify({ query, variables, operationName }),
    headers: {
      "Content-Type": "application/json",
    },
  })
  return await res.json()
}

const config = {
  // ... other options
  execute,
}
```

The default implementation [`createDefaultQueryExecutor`](#createdefaultqueryexecutor) is very similar,
except that it also controls query concurrency using an excellent [`p-queue`][11] library.

Use [`wrapQueryExecutorWithQueue`](#wrapqueryexecutorwithqueue) to re-use concurrency logic for
your custom executor.

### Gatsby field aliases

```ts
interface ISourcingConfig {
  // ...
  gatsbyFieldAliases?: { [field: string]: string }
  // ...
}
```

This is just a simple object that defines which aliases to use for internal
Gatsby fields when compiling queries ([step 4](#4-compile-sourcing-queries)).

Default value is:

```js
const defaultGatsbyFieldAliases = {
  __typename: "remoteTypeName",
  id: "remoteId",
  internal: "remoteInternal",
  children: "remoteChildren",
  parent: "remoteParent",
}
```

### Type name transformer

The toolkit must transform type names from the remote schema to Gatsby schema:

```ts
interface ISourcingConfig {
  // ...
  gatsbyTypePrefix: string
  typeNameTransform?: ITypeNameTransform
}

export interface ITypeNameTransform {
  toGatsbyTypeName: (remoteTypeName: string) => string
  toRemoteTypeName: (gatsbyTypeName: string) => string
}
```

Default implementation uses `gatsbyTypePrefix` option and is as simple as:

```js
function createTypeNameTransform(prefix) {
  return {
    toGatsbyTypeName: remoteTypeName => `${prefix}${remoteTypeName}`,
    toRemoteTypeName: gatsbyTypeName => gatsbyTypeName.substr(prefix.length),
  }
}
```

> Note: the toolkit uses this transformer to convert EVERY type name, not only node types.

### Custom Pagination Adapter

```ts
interface ISourcingConfig {
  // ...
  paginationAdapters?: IPaginationAdapter<any, any>[]
}
```

You can add a new (or override existing) adapters by providing you own implementations
conforming to this interface:

```ts
interface IPageInfo {
  variables: { [name: string]: unknown }
  hasNextPage: boolean
}

interface IPaginationAdapter<TPage, TItem> {
  name: string
  expectedVariableNames: string[]
  start(): IPageInfo
  next(current: IPageInfo, page: TPage): IPageInfo
  concat(acc: TPage, page: TPage): TPage
  getItems(page: TPage): Array<TItem | null>
}
```

Check out the `src/config/pagination-adapters` folder for examples.

> Note: when setting `paginationAdapters` option you override built-in adapters completely
> So if you want to be able to still use one of the existing adapters, pass them along with
> your custom adapters:

```js
const { PaginationAdapters } = require('gatsby-graphql-source-toolkit')
const MyCustomAdapter = {
  // Your implementation
}
const config = {
  // ... other options
  paginationAdapters: PaginationAdapters.concat(MyCustomAdapter)
}
```

## Tools Reference

### Configuration Tools
#### createDefaultQueryExecutor
#### wrapQueryExecutorWithQueue

Creates a function 

#### loadSchema
#### buildNodeDefinitions

### Query compilation tools
#### generateDefaultFragments
#### compileNodeQueries

### Schema customization tools
#### createSchemaCustomization

### Source nodes tools
#### sourceAllNodes
#### sourceNodeChanges
#### fetchAllNodes
#### fetchNodeList
#### fetchNodesById
#### fetchNodeById

## TODO:

- [ ] Mime-type mapping on nodes
- [ ] Ignore deleted nodes when resolving references
- [ ] Allow custom variables in schema customization?
- [ ] Add docs about "sourcing node field with pagination"
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
[9]: https://www.gatsbyjs.org/docs/actions/#createNode
[10]: https://relay.dev/graphql/connections.htm
[11]: https://github.com/sindresorhus/p-queue