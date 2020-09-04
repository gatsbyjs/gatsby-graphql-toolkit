import { ISourcingConfig, ITypeNameTransform } from "../types"

export function createTypeNameTransform(
  config: ISourcingConfig
): ITypeNameTransform {
  const prefix = config.gatsbyTypePrefix
  const { remote2gatsby, gatsby2remote } = buildNameMaps(config)

  return {
    toGatsbyTypeName: remoteTypeName =>
      remote2gatsby.get(remoteTypeName) ?? `${prefix}${remoteTypeName}`,
    toRemoteTypeName: gatsbyTypeName =>
      gatsby2remote.get(gatsbyTypeName) ?? gatsbyTypeName.substr(prefix.length),
  }
}

function buildNameMaps(config: ISourcingConfig) {
  // Fix collision: For every node type Gatsby creates a corresponding Connection Type
  //   But if remote source has it's own connection type - we get a naming conflict
  //   For example: Remote API has types MyProduct and MyProductConnection
  //   But Gatsby also creates its own MyProductConnection that is different from the remote type
  //   To resolve this we rename original connection type to MyProductConnection_Remote
  const prefix = config.gatsbyTypePrefix
  const remoteConnectionTypes = Array.from(config.gatsbyNodeDefs.keys()).map(
    remoteTypeName => `${remoteTypeName}Connection`
  )
  const remote2gatsby = new Map(
    remoteConnectionTypes.map(remoteName => [
      remoteName,
      `${prefix}${remoteName}_Remote`,
    ])
  )
  const gatsby2remote = new Map(
    remoteConnectionTypes.map(remoteName => [
      `${prefix}${remoteName}_Remote`,
      remoteName,
    ])
  )
  return { remote2gatsby, gatsby2remote }
}
