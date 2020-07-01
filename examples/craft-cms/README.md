<!-- AUTO-GENERATED-CONTENT:START (STARTER) -->
<p align="center">
  <a href="https://www.gatsbyjs.org">
    <img alt="Gatsby" src="https://www.gatsbyjs.org/monogram.svg" width="60" />
  </a>
</p>

# Example: Craft CMS GraphQL API

Craft CMS exposes a nice [GraphQL API](https://docs.craftcms.com/v3/graphql.html)
which is our endpoint in this plugin.

Every Craft instance is different but they all have common interfaces and root fields.

Interfaces: 

- `EntryInterface`
- `AssetInterface`
- `UserInterface`
- `GlobalSetIterface`
- `TagInterface`

Each of those also have a corresponding root field. Knowing this we can dynamically
detect specific types implementing those interfaces and construct queries
for sourcing.

Refer to [`gatsby-node.js`](./gatsby-node.js) for details.

# Usage:
Add an `.env` file to the root of this example with your API details:

```title:.env
CRAFTGQL_TOKEN=YOUR_TOKEN
CRAFTGQL_URL=https://craftcms-endpoint
```

We use `CRAFTGQL_TOKEN` in `Authorization: Bearer ${process.env.CRAFTGQL_TOKEN}`
