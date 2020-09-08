# Unreleased

## Feat: nested fragment spreads

Now you can do things like this:

```graphql
fragment User on User {
  dateOfBirth { ...UtcTime }
}
fragment UtcTime on DateTime {
  utcTime
}
```

Before v0.5.0 this set of fragments would have thrown an error because only 
fragment on Node types were supported. Now nested fragment spreads on non-node types
are supported as well.

## Fix: correctly add remoteTypeName to list fields

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

## Schema customization: changed the logic of collecting interface fields

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

## Use ID fragments instead of `remoteIdFields` in the config

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

## generateDefaultFragments: added `fields` to the list of aliased fields

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
