import { buildSchema } from "graphql"
import { generateDefaultFragments } from "../generate-default-fragments"
import { dedent } from "../../__tests__/test-utils"
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
  interface IfaceFoo {
    testId: ID
    foo: String
  }
  type FooImpl1 implements IfaceFoo {
    testId: ID
    foo: String
    fooImpl1: String
  }
  type FooImpl2 implements IfaceFoo {
    testId: ID
    foo: String
    fooImpl2: Int!
  }
  type WithIfaceFoo {
    testId: ID
    foo: IfaceFoo
  }
  union FooUnion = FooImpl1  | FooImpl2
  type WithFooUnion {
    testId: ID
    foo: FooUnion
  }
  interface IfaceSelfCycle {
    testId: ID
    cycle: IfaceSelfCycle
  }
  type IfaceSelfCycleImpl1 implements IfaceSelfCycle {
    testId: ID
    cycle: IfaceSelfCycle
    impl1: String
  }
  type IfaceSelfCycleImpl2 implements IfaceSelfCycle {
    testId: ID
    cycle: IfaceSelfCycle
    impl2: String
  }
  type WithIfaceSelfCycle{
    testId: ID
    cycle: IfaceSelfCycle
  }
  interface FooConflictIface {
    testId: ID
  }
  type FooConflict1 implements FooConflictIface {
    testId: ID
    foo: String!
  }
  type FooConflict2 implements FooConflictIface {
    testId: ID
    foo: Int!
  }
  union FooConflictUnion = FooConflict1 | FooConflict2
  type WithFooConflict {
    testId: ID
    fooIface: FooConflictIface
    fooUnion: FooConflictUnion
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
  WithIfaceFoo: IGatsbyNodeConfig
  FooImpl1: IGatsbyNodeConfig
  FooImpl2: IGatsbyNodeConfig
  WithFooUnion: IGatsbyNodeConfig
  IfaceSelfCycleImpl1: IGatsbyNodeConfig
  IfaceSelfCycleImpl2: IGatsbyNodeConfig
  WithIfaceSelfCycle: IGatsbyNodeConfig
  WithFooConflict: IGatsbyNodeConfig
  FooConflict1: IGatsbyNodeConfig
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
  WithIfaceFoo: {
    remoteTypeName: `WithIfaceFoo`,
    queries: `
      query { WithIfaceFoo { ...WithIfaceFooId  } }
      fragment WithIfaceFooId on WithIfaceFoo { testId }
    `,
  },
  FooImpl1: {
    remoteTypeName: `FooImpl1`,
    queries: `
      query { FooImpl1 { ...FooImpl1Id  } }
      fragment FooImpl1Id on FooImpl1 { testId }
    `,
  },
  FooImpl2: {
    remoteTypeName: `FooImpl2`,
    queries: `
      query { FooImpl2 { ...FooImpl2Id  } }
      fragment FooImpl2Id on FooImpl2 { testId }
    `,
  },
  WithFooUnion: {
    remoteTypeName: `WithFooUnion`,
    queries: `
      query { withFooUnion { ...WithFooUnionId  } }
      fragment WithFooUnionId on WithFooUnion { testId }
    `,
  },
  IfaceSelfCycleImpl1: {
    remoteTypeName: `IfaceSelfCycleImpl1`,
    queries: `
      query { withIfaceSelfCycleImpl1 { ...IfaceSelfCycleImpl1Id  } }
      fragment IfaceSelfCycleImpl1Id on IfaceSelfCycleImpl1 { testId }
    `,
  },
  IfaceSelfCycleImpl2: {
    remoteTypeName: `IfaceSelfCycleImpl2`,
    queries: `
      query { withIfaceSelfCycleImpl2 { ...IfaceSelfCycleImpl1Id  } }
      fragment IfaceSelfCycleImpl2Id on IfaceSelfCycleImpl2 { testId }
    `,
  },
  WithIfaceSelfCycle: {
    remoteTypeName: `WithIfaceSelfCycle`,
    queries: `
      query { withIfaceSelfCycle { ...WithIfaceSelfCycleId  } }
      fragment WithIfaceSelfCycleId on WithIfaceSelfCycle { testId }
    `,
  },
  WithFooConflict: {
    remoteTypeName: `WithFooConflict`,
    queries: `
      query { withFooConflict { ...WithFooConflictId  } }
      fragment WithFooConflictId on WithFooConflict { testId }
    `,
  },
  FooConflict1: {
    remoteTypeName: `FooConflict1`,
    queries: `
      query { fooConflict1 { ...FooConflict1Id  } }
      fragment FooConflict1Id on FooConflict1 { testId }
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
            remoteTypeName: __typename
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
            remoteTypeName: __typename
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
            remoteTypeName: __typename
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

  it(`aliases internal Gatsby fields on node types`, () => {
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
            id
            internal
            parent
            children
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
        field => (field.name === `bar` ? { arg: `barArg` } : undefined),
        field => (field.name === `foo` ? { arg: `fooArg` } : undefined),
      ],
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

describe(`abstract types (interfaces, unions)`, () => {
  it(`works with fields of non-node interface type`, () => {
    const result = generateDefaultFragments({
      schema,
      gatsbyNodeTypes: [nodeTypes.WithIfaceFoo],
    })

    expect(result.size).toEqual(1)
    expect(result.get(`WithIfaceFoo`)).toEqual(dedent`
      fragment WithIfaceFoo on WithIfaceFoo {
        testId
        foo {
          ... on FooImpl1 {
            testId
            foo
            fooImpl1
          }
          ... on FooImpl2 {
            testId
            foo
            fooImpl2
          }
        }
      }
    `)
  })

  it(`works with fields of node interface type`, () => {
    const result = generateDefaultFragments({
      schema,
      gatsbyNodeTypes: [
        nodeTypes.WithIfaceFoo,
        nodeTypes.FooImpl1,
        nodeTypes.FooImpl2,
      ],
    })

    expect(result.size).toEqual(3)
    expect(result.get(`WithIfaceFoo`)).toEqual(dedent`
      fragment WithIfaceFoo on WithIfaceFoo {
        testId
        foo {
          ... on IfaceFoo {
            remoteTypeName: __typename
            testId
          }
        }
      }
    `)
  })

  it(`works with fields of mixed interface type`, () => {
    const result = generateDefaultFragments({
      schema,
      gatsbyNodeTypes: [nodeTypes.WithIfaceFoo, nodeTypes.FooImpl1],
    })

    expect(result.size).toEqual(2)
    expect(result.get(`WithIfaceFoo`)).toEqual(dedent`
      fragment WithIfaceFoo on WithIfaceFoo {
        testId
        foo {
          ... on FooImpl1 {
            remoteTypeName: __typename
            testId
          }
          ... on FooImpl2 {
            testId
            foo
            fooImpl2
          }
        }
      }
    `)
  })

  it(`works with fields of non-node union type`, () => {
    const result = generateDefaultFragments({
      schema,
      gatsbyNodeTypes: [nodeTypes.WithFooUnion],
    })

    expect(result.size).toEqual(1)
    expect(result.get(`WithFooUnion`)).toEqual(dedent`
      fragment WithFooUnion on WithFooUnion {
        testId
        foo {
          ... on FooImpl1 {
            testId
            foo
            fooImpl1
          }
          ... on FooImpl2 {
            testId
            foo
            fooImpl2
          }
        }
      }
    `)
  })

  it(`works with fields of node union type`, () => {
    const result = generateDefaultFragments({
      schema,
      gatsbyNodeTypes: [
        nodeTypes.WithFooUnion,
        nodeTypes.FooImpl1,
        nodeTypes.FooImpl2,
      ],
    })

    expect(result.size).toEqual(3)
    expect(result.get(`WithFooUnion`)).toEqual(dedent`
      fragment WithFooUnion on WithFooUnion {
        testId
        foo {
          ... on FooImpl1 {
            remoteTypeName: __typename
            testId
          }
          ... on FooImpl2 {
            remoteTypeName: __typename
            testId
          }
        }
      }
    `)
  })
  it(`works with fields of mixed union type`, () => {
    const result = generateDefaultFragments({
      schema,
      gatsbyNodeTypes: [nodeTypes.WithFooUnion, nodeTypes.FooImpl1],
    })

    expect(result.size).toEqual(2)
    expect(result.get(`WithFooUnion`)).toEqual(dedent`
      fragment WithFooUnion on WithFooUnion {
        testId
        foo {
          ... on FooImpl1 {
            remoteTypeName: __typename
            testId
          }
          ... on FooImpl2 {
            testId
            foo
            fooImpl2
          }
        }
      }
    `)
  })
  it(`works with circular node interface fields`, () => {
    const result = generateDefaultFragments({
      schema,
      gatsbyNodeTypes: [
        nodeTypes.WithIfaceSelfCycle,
        nodeTypes.IfaceSelfCycleImpl1,
        nodeTypes.IfaceSelfCycleImpl2,
      ],
    })

    expect(result.size).toEqual(3)
    expect(result.get(`WithIfaceSelfCycle`)).toEqual(dedent`
      fragment WithIfaceSelfCycle on WithIfaceSelfCycle {
        testId
        cycle {
          ... on IfaceSelfCycle {
            remoteTypeName: __typename
            testId
          }
        }
      }
    `)
    expect(result.get(`IfaceSelfCycleImpl1`)).toEqual(dedent`
      fragment IfaceSelfCycleImpl1 on IfaceSelfCycleImpl1 {
        testId
        cycle {
          ... on IfaceSelfCycle {
            remoteTypeName: __typename
            testId
          }
        }
        impl1
      }
    `)
    expect(result.get(`IfaceSelfCycleImpl2`)).toEqual(dedent`
      fragment IfaceSelfCycleImpl2 on IfaceSelfCycleImpl2 {
        testId
        cycle {
          ... on IfaceSelfCycle {
            remoteTypeName: __typename
            testId
          }
        }
        impl2
      }
    `)
  })

  it(`works with circular non-node interface fields`, () => {
    const result = generateDefaultFragments({
      schema,
      gatsbyNodeTypes: [nodeTypes.WithIfaceSelfCycle],
    })

    expect(result.size).toEqual(1)
    expect(result.get(`WithIfaceSelfCycle`)).toEqual(dedent`
      fragment WithIfaceSelfCycle on WithIfaceSelfCycle {
        testId
        cycle {
          ... on IfaceSelfCycleImpl1 {
            testId
            cycle {
              remoteTypeName: __typename
            }
            impl1
          }
          ... on IfaceSelfCycleImpl2 {
            testId
            cycle {
              remoteTypeName: __typename
            }
            impl2
          }
        }
      }
    `)
  })

  it(`works with circular mixed interface fields`, () => {
    const result = generateDefaultFragments({
      schema,
      gatsbyNodeTypes: [
        nodeTypes.WithIfaceSelfCycle,
        nodeTypes.IfaceSelfCycleImpl1,
      ],
    })

    expect(result.size).toEqual(2)
    expect(result.get(`WithIfaceSelfCycle`)).toEqual(dedent`
      fragment WithIfaceSelfCycle on WithIfaceSelfCycle {
        testId
        cycle {
          ... on IfaceSelfCycleImpl1 {
            remoteTypeName: __typename
            testId
          }
          ... on IfaceSelfCycleImpl2 {
            testId
            cycle {
              remoteTypeName: __typename
            }
            impl2
          }
        }
      }
    `)
    expect(result.get(`IfaceSelfCycleImpl1`)).toEqual(dedent`
      fragment IfaceSelfCycleImpl1 on IfaceSelfCycleImpl1 {
        testId
        cycle {
          ... on IfaceSelfCycleImpl1 {
            remoteTypeName: __typename
            testId
          }
          ... on IfaceSelfCycleImpl2 {
            testId
            cycle {
              remoteTypeName: __typename
            }
            impl2
          }
        }
        impl1
      }
    `)
  })

  // TODO: test transitive interface cycles
  // TODO: test invalid input

  // TODO: see https://github.com/graphql/graphql-js/issues/522#issuecomment-255837127
  it.skip(`ignores conflicting fields of non-node interfaces and unions`, () => {
    const result = generateDefaultFragments({
      schema,
      gatsbyNodeTypes: [nodeTypes.WithFooConflict],
    })

    expect(result.size).toEqual(1)
    expect(result.get(`WithFooConflict`)).toEqual(dedent`
      fragment WithFooConflict on WithFooConflict {
        testId
        fooIface {
          ... on FooConflict1 {
            testId
          }
          ... on FooConflict2 {
            testId
          }
        }
        fooUnion {
          ... on FooConflict1 {
            testId
          }
          ... on FooConflict2 {
            testId
          }
        }
      }
    `)
  })

  it(`includes conflicting fields of mixed interfaces when possible`, () => {
    const result = generateDefaultFragments({
      schema,
      gatsbyNodeTypes: [nodeTypes.WithFooConflict, nodeTypes.FooConflict1],
    })

    expect(result.size).toEqual(2)
    expect(result.get(`WithFooConflict`)).toEqual(dedent`
      fragment WithFooConflict on WithFooConflict {
        testId
        fooIface {
          ... on FooConflict1 {
            remoteTypeName: __typename
            testId
          }
          ... on FooConflict2 {
            testId
            foo
          }
        }
        fooUnion {
          ... on FooConflict1 {
            remoteTypeName: __typename
            testId
          }
          ... on FooConflict2 {
            testId
            foo
          }
        }
      }
    `)
  })
})
