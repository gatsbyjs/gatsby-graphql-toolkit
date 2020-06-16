import { DEFAULT_PAGE_SIZE } from "../../constants"
import { IPaginationStrategy } from "./types"

interface IRelayResult {
  edges: { cursor: string; node: object }[]
  pageInfo: { hasNextPage: boolean }
}

export const RelayForward: IPaginationStrategy<IRelayResult, object> = {
  name: "RelayForward",
  test: variables => variables.has(`first`) && variables.has(`after`),
  start() {
    return {
      result: { edges: [], pageInfo: { hasNextPage: true } },
      variables: { first: DEFAULT_PAGE_SIZE, after: undefined },
      hasNextPage: true,
    }
  },
  addPage(state, page) {
    const tail = page.edges[page.edges.length - 1]
    const first = Number(state.variables.first) ?? DEFAULT_PAGE_SIZE
    const after = tail?.cursor
    return {
      result: {
        pageInfo: page.pageInfo,
        edges: state.result.edges.concat(page.edges),
      },
      variables: { first, after },
      hasNextPage: Boolean(page?.pageInfo?.hasNextPage && tail),
    }
  },
  getItems(pageOrResult) {
    return pageOrResult.edges.map(edge => edge.node)
  },
}
