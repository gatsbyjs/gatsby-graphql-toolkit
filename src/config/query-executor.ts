import { inspect } from "util"
import PQueue, { Options as PQueueOptions } from "p-queue"
import fetch, { RequestInit as FetchOptions } from "node-fetch"
import { IQueryExecutionArgs, IQueryExecutor } from "../types"

export function createNetworkQueryExecutor(
  uri: string,
  fetchOptions: FetchOptions = {}
): IQueryExecutor {
  return async function execute(args) {
    const { query, variables, operationName } = args

    const response = await fetch(uri, {
      method: "POST",
      body: JSON.stringify({ query, variables, operationName }),
      ...fetchOptions,
      headers: {
        "Content-Type": "application/json",
        ...fetchOptions.headers,
      },
    })
    if (!response.ok) {
      console.warn(
        `Query ${operationName} returned status ${response.status}.\n` +
          `Query variables: ${inspect(variables)}`
      )
    }
    const result = await response.json()

    if (result.data && result.errors?.length) {
      console.warn(
        `Query ${operationName} returned warnings:\n` +
          `${inspect(result.errors)}\n` +
          `Query variables: ${inspect(variables)}`
      )
    }
    return result
  }
}

/**
 * Takes existing query `executor` function and creates a new
 * function with the same signature that runs with given
 * concurrency level (`10` by default).
 *
 * See p-queue library docs for all available `queueOptions`
 */
export function wrapQueryExecutorWithQueue(
  executor: IQueryExecutor,
  queueOptions: PQueueOptions<any, any> = { concurrency: 10 }
): IQueryExecutor {
  const queryQueue = new PQueue(queueOptions)

  return async function executeQueued(args: IQueryExecutionArgs) {
    return await queryQueue.add(() => executor(args))
  }
}

/**
 * Creates default query executor suitable for sourcing config
 */
export function createDefaultQueryExecutor(
  uri: string,
  fetchOptions: FetchOptions,
  queueOptions: PQueueOptions<any, any> = { concurrency: 10 }
): IQueryExecutor {
  const executor = createNetworkQueryExecutor(uri, fetchOptions)

  return wrapQueryExecutorWithQueue(executor, queueOptions)
}
