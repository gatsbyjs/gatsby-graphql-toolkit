import { LimitOffset } from "./limit-offset"
import { RelayForward } from "./relay"

export * from "./types"
export const PaginationStrategies = [LimitOffset, RelayForward]
