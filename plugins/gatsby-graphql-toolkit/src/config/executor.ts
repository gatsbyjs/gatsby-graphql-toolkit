import PQueue, { Options as PQueueOptions } from "p-queue"
import fetch, { RequestInit as FetchOptions } from "node-fetch"
import { IQueryExecutionArgs, IQueryExecutor } from "../types"

export function createNetworkExecutor(
  uri: string,
  fetchOptions: FetchOptions
): IQueryExecutor {
  return async function execute(args) {
    const { query, variables, operationName } = args

    return fetch(uri, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, variables, operationName }),
      ...fetchOptions,
    }).then(res => res.json())
  }
}

export function withQueue(
  executor: IQueryExecutor,
  queueOptions: PQueueOptions<any, any>
): IQueryExecutor {
  const queryQueue = new PQueue(queueOptions)

  return async function executeQueued(args: IQueryExecutionArgs) {
    return await queryQueue.add(() => executor(args))
  }
}

export function createDefaultExecutor(
  uri: string,
  fetchOptions: FetchOptions,
  queueOptions: PQueueOptions<any, any> = { concurrency: 5 }
): IQueryExecutor {
  const executor = createNetworkExecutor(uri, fetchOptions)

  return withQueue(executor, queueOptions)
}
