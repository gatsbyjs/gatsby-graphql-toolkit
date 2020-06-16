export interface IPaginationState<TResult> {
  result: TResult
  variables: { [name: string]: unknown }
  hasNextPage: boolean
}

type VariableName = string

export interface IPaginationStrategy<T, U> {
  name: string
  test(variableNames: Set<VariableName>): boolean
  start(): IPaginationState<T>
  addPage(state: IPaginationState<T>, page: T): IPaginationState<T>
  getItems(pageOrResult: T): U[]
}
