import { LimitOffset } from "./limit-offset"
import { RelayForward } from "./relay"

export * from "./types"
const PaginationAdapters = [LimitOffset, RelayForward]

export { LimitOffset, RelayForward, PaginationAdapters }
