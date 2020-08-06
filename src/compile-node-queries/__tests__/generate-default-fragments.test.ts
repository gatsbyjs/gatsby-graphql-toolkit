import { generateDefaultFragments } from "../generate-default-fragments"
import { buildSchema, print, parse } from "graphql"
import { IGatsbyNodeConfig } from "../../types"

const schema = buildSchema(`
  enum FooBarEnum {
    FOO
    BAR
  }
  type Foo {
    testId: ID
    string: String
    int: Int
    float: Float
    enum: FooBarEnum
    withWrappers: [String!]!
  }
  type Bar {
    testId: ID
    foo: Foo
  }
  type SelfCycle {
    testId: ID
    selfCycle: SelfCycle
  }
  type WithCycle {
    testId: ID
    cycle: SelfCycle
  }
  type FooTransitiveCycle {
    testId: ID
    bar: BarTransitiveCycle
  }
  type BarTransitiveCycle {
    testId: ID
    baz: BazTransitiveCycle
  }
  type BazTransitiveCycle {
    testId: ID
    foo: FooTransitiveCycle
  }
  type WithTransitiveCycle {
    testId: ID
    cycle: FooTransitiveCycle
  }
  type GatsbyFields {
    id: ID
    internal: String
    parent: String
    children: String 
  }
  type WithGatsbyFields {
    id: ID
    internal: String
    parent: String
    children: String
    fields: GatsbyFields
  }
  type WithArguments {
    testId: ID
    foo(arg: String): String
    bar(arg: String!): String
  }
`)

const nodeTypes: {
  Foo: IGatsbyNodeConfig
  Bar: IGatsbyNodeConfig
  SelfCycle: IGatsbyNodeConfig
  WithCycle: IGatsbyNodeConfig
  WithTransitiveCycle: IGatsbyNodeConfig
  WithGatsbyFields: IGatsbyNodeConfig
  WithArguments: IGatsbyNodeConfig
} = {
  Foo: {
    remoteTypeName: `Foo`,
    queries: `
      query { foo { ...FooId } }
      fragment FooId on Foo { testId }
    `,
  },
  Bar: {
    remoteTypeName: `Bar`,
    queries: `
      query { bar { ...BarId } }
      fragment BarId on Bar { testId }
    `,
  },
  SelfCycle: {
    remoteTypeName: `SelfCycle`,
    queries: `
      query { selfCycle { ...SelfCycleId } }
      fragment SelfCycleId on SelfCycle { testId }
    `,
  },
  WithCycle: {
    remoteTypeName: `WithCycle`,
    queries: `
      query { withCycle { ...WithCycleId } }
      fragment WithCycleId on WithCycle { testId }
    `,
  },
  WithTransitiveCycle: {
    remoteTypeName: `WithTransitiveCycle`,
    queries: `
      query { withTransitiveCycle { ...WithTransitiveCycleId } }
      fragment WithTransitiveCycleId on WithTransitiveCycle { testId }
    `,
  },
  WithGatsbyFields: {
    remoteTypeName: `WithGatsbyFields`,
    queries: `
      query { withGatsbyFields { ...WithGatsbyFieldsId } }
      fragment WithGatsbyFieldsId on WithGatsbyFields { testId }
    `,
  },
  WithArguments: {
    remoteTypeName: `WithArguments`,
    queries: `
      query { withArguments { ...WithArgumentsId } }
      fragment WithArgumentsId on WithArguments { testId }
    `,
  },
}

describe(`simple types (scalars, objects)`, () => {
  it(`works with simple fields`, () => {
    const result = generateDefaultFragments({
      schema,
      gatsbyNodeTypes: [nodeTypes.Foo],
    })

    expect(result.size).toEqual(1)
    expect(result.get(`Foo`)).toEqual(dedent`
      fragment Foo on Foo {
        testId
        string
        int
        float
        enum
        withWrappers
      }
    `)
  })

  it(`works with nested simple fields`, () => {
    const result = generateDefaultFragments({
      schema,
      gatsbyNodeTypes: [nodeTypes.Bar],
    })

    expect(result.size).toEqual(1)
    expect(result.get(`Bar`)).toEqual(dedent`
      fragment Bar on Bar {
        testId
        foo {
          ... on Foo {
            testId
            string
            int
            float
            enum
            withWrappers
          }
        }
      }
    `)
  })

  it(`works with fields of other node type`, () => {
    const result = generateDefaultFragments({
      schema,
      gatsbyNodeTypes: [nodeTypes.Foo, nodeTypes.Bar],
    })

    expect(result.size).toEqual(2)
    expect(result.get(`Bar`)).toEqual(dedent`
      fragment Bar on Bar {
        testId
        foo {
          ... on Foo {
            testId
          }
        }
      }
    `)
  })

  it(`works with self-circular node fields`, () => {
    const result = generateDefaultFragments({
      schema,
      gatsbyNodeTypes: [nodeTypes.SelfCycle],
    })

    expect(result.size).toEqual(1)
    expect(result.get(`SelfCycle`)).toEqual(dedent`
      fragment SelfCycle on SelfCycle {
        testId
        selfCycle {
          ... on SelfCycle {
            testId
          }
        }
      }
    `)
  })

  it(`works with circular node fields`, () => {
    const result = generateDefaultFragments({
      schema,
      gatsbyNodeTypes: [nodeTypes.WithCycle, nodeTypes.SelfCycle],
    })

    expect(result.size).toEqual(2)
    expect(result.get(`WithCycle`)).toEqual(dedent`
      fragment WithCycle on WithCycle {
        testId
        cycle {
          ... on SelfCycle {
            testId
          }
        }
      }
    `)
  })

  it(`works with circular non-node fields`, () => {
    const result = generateDefaultFragments({
      schema,
      gatsbyNodeTypes: [nodeTypes.WithCycle],
    })

    // TODO: this should omit selfCycle field altogether
    expect(result.size).toEqual(1)
    expect(result.get(`WithCycle`)).toEqual(dedent`
      fragment WithCycle on WithCycle {
        testId
        cycle {
          ... on SelfCycle {
            testId
            selfCycle {
              remoteTypeName: __typename
            }
          }
        }
      }
    `)
  })

  it(`works with transitive cyclic non-node fields`, () => {
    const result = generateDefaultFragments({
      schema,
      gatsbyNodeTypes: [nodeTypes.WithTransitiveCycle],
    })

    expect(result.size).toEqual(1)
    expect(result.get(`WithTransitiveCycle`)).toEqual(dedent`
      fragment WithTransitiveCycle on WithTransitiveCycle {
        testId
        cycle {
          ... on FooTransitiveCycle {
            testId
            bar {
              ... on BarTransitiveCycle {
                testId
                baz {
                  ... on BazTransitiveCycle {
                    testId
                    foo {
                      remoteTypeName: __typename
                    }
                  }
                }
              }
            }
          }
        }
      }
    `)
  })

  it(`aliases internal Gatsby fields`, () => {
    const result = generateDefaultFragments({
      schema,
      gatsbyNodeTypes: [nodeTypes.WithGatsbyFields],
    })

    expect(result.size).toEqual(1)
    expect(result.get(`WithGatsbyFields`)).toEqual(dedent`
      fragment WithGatsbyFields on WithGatsbyFields {
        remoteId: id
        remoteInternal: internal
        remoteParent: parent
        remoteChildren: children
        remoteFields: fields {
          ... on GatsbyFields {
            remoteId: id
            remoteInternal: internal
            remoteParent: parent
            remoteChildren: children
          }
        }
      }
    `)
  })

  it(`allows providing custom field aliases`, () => {
    const result = generateDefaultFragments({
      schema,
      gatsbyNodeTypes: [nodeTypes.Foo],
      gatsbyFieldAliases: { string: `aliasedString`, enum: `aliasedEnum` },
    })

    expect(result.size).toEqual(1)
    expect(result.get(`Foo`)).toEqual(dedent`
      fragment Foo on Foo {
        testId
        aliasedString: string
        int
        float
        aliasedEnum: enum
        withWrappers
      }
    `)
  })

  it(`includes fields with nullable arguments only (by default)`, () => {
    const result = generateDefaultFragments({
      schema,
      gatsbyNodeTypes: [nodeTypes.WithArguments],
    })

    expect(result.get(`WithArguments`)).toEqual(dedent`
      fragment WithArguments on WithArguments {
        testId
        foo
      }
    `)
  })

  it(`allows providing default argument values`, () => {
    const result = generateDefaultFragments({
      schema,
      gatsbyNodeTypes: [nodeTypes.WithArguments],
      defaultArgumentValues: [
        (field) => field.name === `bar` ? { arg: `barArg` } : undefined,
        (field) => field.name === `foo` ? { arg: `fooArg` } : undefined,
      ]
    })

    expect(result.get(`WithArguments`)).toEqual(dedent`
      fragment WithArguments on WithArguments {
        testId
        foo(arg: "fooArg")
        bar(arg: "barArg")
      }
    `)
  })

  it.todo(`allows aliasing fields with arguments`)
})

describe(`with abstract types (interfaces, unions)`, () => {
  it.todo(`works with fields of non-node interface type`)
  it.todo(`works with fields of node interface type`)
  it.todo(`works with fields of mixed interface type`)
  it.todo(`works with fields of non-node union type`)
  it.todo(`works with fields of node union type`)
  it.todo(`works with fields of mixed union type`)
  it.todo(`works with fields of self type`)
  it.todo(`works with nested fields of self type`)
})

function dedent(gqlStrings) {
  return print(parse(gqlStrings[0])).replace(/\n$/, ``)
}
