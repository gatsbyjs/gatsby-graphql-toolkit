import { createTestContext } from "./test-utils/blog-schema"
import { buildFields } from "../build-fields"

describe(`Collect fields from queries`, () => {
  it(`collects empty object when nothing is queried`, () => {
    const objFields = buildFields(createTestContext(), `Author`)
    const interfaceFields = buildFields(createTestContext(), `Entry`)

    expect(objFields).toEqual({})
    expect(interfaceFields).toEqual({})
  })

  it.todo(`collects all fields referenced in queries for this type`)
  it.todo(
    `additionally collects fields from all type interfaces for object types`
  )
  it.todo(`collects field aliases as type fields`)
  it.todo(`correctly skips __typename field`)

  it.todo(`collects fields of type object`)
  it.todo(`collects fields of type object with listOf and nonNull wrappers`)

  it.todo(`collects fields of gatsby node types`)
  it.todo(
    `collects fields of gatsby node types with listOf and nonNull wrappers`
  )

  it.todo(`collects fields of interface type`)
  it.todo(`collects fields of interface type with listOf and nonNull wrappers`)

  it.todo(`collects fields of union type`)
  it.todo(`collects fields of union type with listOf and nonNull wrappers`)

  it.todo(`collects fields of internal scalar types`)
  it.todo(
    `collects fields of internal scalar types with listOf and nonNull wrappers`
  )

  it.todo(`collects fields of custom scalar types`)
  it.todo(
    `collects fields of custom scalar types with listOf and nonNull wrappers`
  )

  it.todo(`collects enum fields`)
  it.todo(`collects enum fields with listOf and nonNull wrappers`)

  it.todo(`collects and transforms paginated fields`)
})
