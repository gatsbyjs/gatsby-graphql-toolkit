const {
  sourceAllNodes,
  createSchemaCustomization,
  compileNodeQueries,
  readOrGenerateDefaultFragments,
  buildNodeDefinitions,
  loadSchema,
  createDefaultQueryExecutor,
} = require(`../../dist`)
const { print } = require(`graphql`)

async function createSourcingConfig(gatsbyApi) {
  // Step1. Setup remote schema:
  const execute = createDefaultQueryExecutor(
    `https://countries.trevorblades.com/`,
    undefined,
    { concurrency: 1 }
  )
  const schema = await loadSchema(execute)

  // Step2. Configure Gatsby node types
  const gatsbyNodeTypes = [
    {
      remoteTypeName: `Continent`,
      remoteIdFields: [`__typename`, `code`],
      queries: `query LIST_Continent { continents }`,
    },
    {
      remoteTypeName: `Country`,
      remoteIdFields: [`__typename`, `code`],
      queries: `query LIST_Country { countries }`,
    },
    {
      remoteTypeName: `Language`,
      remoteIdFields: [`__typename`, `code`],
      queries: `query LIST_Language { languages }`,
    },
  ]

  // Step3. Provide (or generate) fragments with fields to be fetched
  const fragments = await readOrGenerateDefaultFragments(
    `./src/api-fragments`,
    { schema, gatsbyNodeTypes }
  )

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
