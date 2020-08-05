# v0.3.0

## Use ID fragments instead of `remoteTypeName`, `remoteIdFields` in config

Update your node type configs like this to account for this change:

```diff
const gatsbyNodeTypes = [
  {
-   remoteIdFields: [`__typename`, `entityId`],
    queries: `
      query LIST_NodeArticle {
        nodeQuery(limit: $limit offset: $offset) {
-         entities
+         entities { ...NodeArticleID }
        }
      }
+     fragment NodeArticleID on NodeArticle {
+       __typename
+       entityId
+     }
    `,
  },
]
```

This has several advantages:
1. Source queries can be tested directly against an API
   (they are now valid queries that fetch node IDs)
2. This format helps to express complex ids (wasn't possible before), e.g.: 
    - Contentful puts id in nested object `sys`;
    - Drupal has a composite id: `{ entityId, entityLanguage { id } }`
