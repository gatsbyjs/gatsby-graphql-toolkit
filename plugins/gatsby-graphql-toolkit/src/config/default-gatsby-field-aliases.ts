import { IGatsbyFieldAliases } from "../types"

export const defaultGatsbyFieldAliases: IGatsbyFieldAliases = {
  __typename: "remoteTypeName",
  id: "remoteNodeId",
  internal: "remoteInternal",
  children: "remoteChildren",
  parent: "remoteParent",
}
