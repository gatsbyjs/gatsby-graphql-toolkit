import { buildSchema } from "graphql"
import { readFileSync } from "fs"

export function createBlogSchema() {
  const source = readFileSync(__dirname + "/../fixtures/schema-blog.graphql")
  return buildSchema(source.toString())
}
