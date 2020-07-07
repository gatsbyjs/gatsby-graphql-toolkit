const {
  sourceAllNodes,
  createSchemaCustomization,
  compileNodeQueries,
  readOrGenerateDefaultFragments,
  buildNodeDefinitions,
  loadSchema,
  createDefaultQueryExecutor,
} = require(`../../dist`)
const { print } = require(`gatsby/graphql`)
const pluralize = require('pluralize')
const fs = require(`fs-extra`)

const debugDir = __dirname + `/.cache/graphcms-compiled-queries`
const fragmentsDir = __dirname + `/graphcms-fragments`

async function writeCompiledQueries(nodeDocs) {
  await fs.ensureDir(debugDir)
  for (const [remoteTypeName, document] of nodeDocs) {
    await fs.writeFile(debugDir + `/${remoteTypeName}.graphql`, print(document))
  }
}

async function createSourcingConfig(gatsbyApi) {
  // Step1. Setup remote schema:
  if (!process.env.GRAPHCMS_URL) {
    throw new Error("Missing process.env.GRAPHCMS_URL")
  }
  const execute = createDefaultQueryExecutor(process.env.GRAPHCMS_URL)
  const schema = await loadSchema(execute)

  const nodeInterface = schema.getType(`Node`)
  const possibleTypes = schema.getPossibleTypes(nodeInterface)

  const gatsbyNodeTypes = possibleTypes.map((type) => ({
    remoteTypeName: type.name,
    remoteIdFields: ['__typename', 'id'],
    queries: `
      query LIST_${pluralize(type.name).toUpperCase()} {
        ${pluralize(type.name).toLowerCase()}(first: $limit, skip: $offset)
      }`,
  }))

  // Step3. Provide (or generate) fragments with fields to be fetched
  fs.ensureDir(fragmentsDir)
  const fragments = await readOrGenerateDefaultFragments(
    fragmentsDir,
    { schema, gatsbyNodeTypes }
  )

  // Step4. Compile sourcing queries
  const documents = compileNodeQueries({
    schema,
    gatsbyNodeTypes,
    customFragments: fragments,
  })

  // Write compiled queries for debugging
  await writeCompiledQueries(documents)

  return {
    gatsbyApi,
    schema,
    execute,
    gatsbyTypePrefix: `Graph_`,
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
