function formatLogMessage(input): string {
  let message
  if (typeof input === `string`) {
    message = input
  } else {
    message = input[0]
  }

  return message
}

export { formatLogMessage }
