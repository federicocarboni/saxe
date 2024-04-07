# Contributing to Saxe

Saxe uses the Google JavaScript style guide, but uses double quotes `"` instead
of single quotes `'` for normal strings.

That guide was intended for code targeting the Google Closure Compiler so ignore
anything which is not relevant for TypeScript.

## Private properties and methods

Hash-prefixed properties and methods `#prop` are not used, so TypeScript
`private` is used instead, to reduce bundle size all private properties and
methods should be suffixed with `_` so that they can be mangled by the build
tool.

E.g.

```ts
class MyClass {
  /** @internal */
  private doSomething_() {
    // ...
  }
}
```

## Style guide in short

- Always UTF-8.
- `UpperCamelCase` for types and classes.
- `camelCase` for functions, methods, properties and variables, even when those
  are constructors.
- Acronyms only have their first letter capitalized, e.g. `XMLParser` should
  instead be `XmlParser`.
- `UPPER_SNAKE_CASE` for enum variants and values intended to be constant.
- Avoid getters and setters. When that functionality is needed use methods
  instead.
- No inheritance. Not even for `Error`s.
- No enums on the public API, enums are specific to TypeScript and are generally
  not a good fit for JavaScript APIs.
- Only use `undefined` instead of `null` internally but assume they are
  interchangeable when receiving values from the user, similar to the behavior
  of the optional chaining operator.

## Compatibility

This library targets modern JavaScript runtimes with support for ES2017 and the
`TextDecoder` DOM API. Additionally any functionality which is difficult to
polyfill or reproduced should be avoided when possible. For example `null`
prototype object are banned together with any weird prototype hacks (`__proto__`
and `Object.{set,get}PrototypeOf()`) and any non portable runtime specific
functionality.
