# Contributing to Saxe

Saxe uses the [Google JavaScript Style Guide], except it uses double quotes `"`
instead of single quotes `'` for regular strings.

That guide was intended for code targeting the Google Closure Compiler so ignore
anything which is not relevant for TypeScript or plain JavaScript.

[Google JavaScript Style Guide]:
https://google.github.io/styleguide/jsguide.html

## Private properties and methods

Hash-prefixed properties and methods `#prop` are not used, so TypeScript
`private` is used instead, to reduce bundle size all private properties and
methods should be suffixed with `_` so that identifiers can be mangled by the
build tool.

E.g.

```ts
class MyClass {
  // @internal
  private doSomething_() {
    // ...
  }
}
```

## Style guide in short

- All source files MUST be in UTF-8.
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
  of the optional chaining operator, which accepts `null` and `undefined` but
  produces `undefined` and not `null`.

## Compatibility

This library targets modern JavaScript runtimes with support for ES2017 and
(optionally the `TextDecoder` DOM API). Additionally any functionality which is
difficult to polyfill or reproduce should be avoided when possible. For example
`null` prototype object are banned together with any prototype hacks,
`__proto__`, `Object.{set,get}PrototypeOf()` and any non portable runtime
specific functionality.

Avoid using modern features for the sake of modern features, just choose the
simplest path to solving the problem.
