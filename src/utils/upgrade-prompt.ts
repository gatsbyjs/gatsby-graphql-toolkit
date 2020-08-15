import chalk from "chalk"
import { IGatsbyNodeConfig, IGatsbyNodeDefinition } from "../types"

export function promptUpgradeIfRequired(
  nodeTypes: Array<IGatsbyNodeConfig | IGatsbyNodeDefinition>
) {
  for (const def of nodeTypes) {
    // @ts-ignore
    if (def.remoteIdFields) {
      upgradeToV03()
    }
  }
}

export function upgradeToV03() {
  console.error(
    `${chalk.white.bgRed(` gatsby-graphql-source-toolkit `)} ` +
      `Starting with version 0.3 the toolkit uses a new format to define "remoteIdFields". ` +
      `Please upgrade using the link below\n\n` +
      `https://github.com/vladar/gatsby-graphql-toolkit/blob/master/CHANGELOG.md#v030`
  )
  process.exit(1)
}
