import { DEFAULT_PAGE_SIZE } from "../../constants"
import { IPaginationStrategy } from "./types";

export const LimitOffset: IPaginationStrategy<unknown[], unknown> = {
  name: "LimitOffset",
  test: variables => variables.has(`limit`) && variables.has(`offset`),
  start() {
    return {
      result: [],
      variables: { limit: DEFAULT_PAGE_SIZE, offset: 0 },
      hasNextPage: true,
    }
  },
  addPage(state, page) {
    const limit = Number(state.variables.limit) ?? DEFAULT_PAGE_SIZE
    const offset = Number(state.variables.offset) + limit
    return {
      result: state.result.concat(page),
      variables: { limit, offset },
      hasNextPage: page.length === limit,
    }
  },
  getItems(pageOrResult) {
    return pageOrResult
  },
}
