## v2.0.1

### Fix: return inspect node for error messages rather than node id directly

Fixes invalid error message "id `[object Object]` is nullish". Now displays actual object contents.


# v2.0.0

### Feat: Gatsby v3 compatibility

**No breaking changes**. Just a version bump and minor tweaks required for `gatsby@^3.0.0` compatibility.

# v1.0.0

### Feat: writeCompiledQueries utility

New debugging utility allowing you to dump compiled queries to disk. Example usage:

```js
const { writeCompiledQueries } = require("gatsby-graphql-source-toolkit")

// Step4. Compile sourcing queries
const documents = compileNodeQueries({
  schema,
  gatsbyNodeTypes,
  customFragments: fragments,
})

// Write compiled queries for debugging
await writeCompiledQueries(`./sourcing-queries`, documents)
```

For each node type it will create a Type.graphql file with full GraphQL queries for this node type. Run those queries against your remote GraphQL endpoint manually for troubleshooting.

### Feat: display warnings in the default query executor

Now whenever GraphQL response contains non-fatal errors, they will be displayed
in the console (but sourcing process will continue).

### Feat: allow passing headers to default query executor

The following now works as expected:

```js
const execute = createDefaultQueryExecutor(`https://www.example.com/graphql`, {
  headers: {
    "Accept": "application/json",
  },
})
```

### Change: removed `gatsby-graphql-toolkit` prefix in CLI messages

### Fix: fixed invalid referencing of non-node types in interface fields

# v0.6.0

### Feat: compile gatsby fragments

Added new experimental tool `compileGatsbyFragments`. Use it to compile custom source fragments to
Gatsby fragments. See [README.md](./README.md#compilegatsbyfragments) for details.

### Fixes

- be smarter when adding a `__typename` field (see [#11](https://github.com/gatsbyjs/gatsby-graphql-toolkit/issues/11))
- support variables within input objects (see [#13](https://github.com/gatsbyjs/gatsby-graphql-toolkit/issues/13))
- support lists with a single value in `NODE_` queries (see [#14](https://github.com/gatsbyjs/gatsby-graphql-toolkit/issues/14))

# v0.5.0

### Feat: nested fragment spreads

Now you can do things like this:

```graphql
fragment User on User {
  dateOfBirth {
    ...UtcTime
  }
}
fragment UtcTime on DateTime {
  utcTime
}
```

Before v0.5.0 this set of fragments would have thrown an error because only
fragment on Node types were supported. Now nested fragment spreads on non-node types
are supported as well.

### Fix: correctly add remoteTypeName to list fields

Before this release the toolkit was incorrect fragments for the following schema:

```graphql
type Foo {
  foo: String
}
type Bar {
  fooList: [Foo!]!
}
```

Before this release it compiled:

```graphql
fragment Bar on Bar {
  fooList {
    foo
  }
}
```

After this release it correctly compiles:

```graphql
fragment Bar on Bar {
  fooList {
    remoteTypeName: __typename
    foo
  }
}
```

This is important for abstract types to resolve specific type
when Gatsby runs queries.

# v0.4.0

### Schema customization: changed the logic of collecting interface fields

Say your remote schema has those types:

```graphql
interface Iface {
  foo: String
}
type Foo implements Iface {
  foo: String
}
```

Before this version the following fragment would add the field `foo`
to Gatsby version of your remote `Iface` type:

```graphql
fragment FooFragment on Foo {
  foo
}
```

After this version it will not. Only the fragment on `Iface` specifically will add it:

```graphql
fragment IfaceFragment on Iface {
  foo
}
```

# v0.3.0

### Use ID fragments instead of `remoteIdFields` in the config

Update your node type configs like this to account for this change:

```diff
const gatsbyNodeTypes = [
  {
    remoteTypeName: `Post`,
-   remoteIdFields: [`__typename`, `id`],
    queries: `
      query LIST_POSTS {
-       posts(limit: $limit offset: $offset)
+       posts(limit: $limit offset: $offset) {
+         ..._PostId_
+       }
      }
+     fragment _PostId_ on Post {
+       __typename
+       id
+     }
    `,
  },
]
```

Note: the name of the fragment id could be anything but try to use a
unique one to avoid possible conflicts with custom fragments
(e.g. in the example above we add `_` as a prefix and a suffix)

This has several advantages:

1. Source queries can be tested directly against the API
   (they are now valid queries that fetch node IDs)

2. This format helps to express complex ids (wasn't possible before), e.g.:
   - Contentful puts id in nested object `sys`;
   - Drupal has a composite id: `{ entityId, entityLanguage { id } }`

### generateDefaultFragments: added `fields` to the list of aliased fields

Diff of function output for various internal Gatsby fields:

```diff
fragment SomeRemoteType on SomeRemoteType {
  remoteId: id
  remoteInternal: internal
  remoteParent: parent
  remoteChildren: children
- fields {
+ remoteFields: fields {
    someField
  }
}
```
