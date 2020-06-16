# Gatsby source GraphQL

## Challenge: Pagination
Solution: Defining pagination strategy for `Type.field`
(will fetch all elements of this field)

## Challenge: Pagination with different sorts

Field transformations:

1. (remoteSchema) -> FieldNode[]
`Type.field` or rule based, i.e. `field: [SomeSpecialType!]`?

e.g.
```graphql
type A {
  a(b: Int): String!
}
```
to 
```graphql
fragment FragmentA on A {
  a(b: 1)
  _a2: a(b: 2)
}
```

Another option:
```graphql
type B {
  b(limit: Int, offset: Int): String!
}
```
to
```graphql
fragment FragmentB on B {
  b(limit: $FragmentBLimit, offset: $FragmentBOffset)
}
```

2. (fragmentUsage, remoteSchema) -> schema customization


Convention:
aliases starting with `_` are not added to schema customization.
You can use them for your custom resolvers
