# Contributing to Saxe

First, a word of thanks for taking the time to contribute.

All contributions are encouraged and valued, use the following guide lines to
make the process is as smooth as possible.

## Reporting Bugs

A good bug report should have:

- All the steps to reproduce
  - Be specific!
  - Provide a code sample or a short XML input if you can
  - Include stack traces if the issue produces an unexpected error
- What you expected to happen
- What actually happened
- Any other information you feel is relevant, if the issue happens in a specific
  environment include its details, e.g. Node.js version 20.x

## Code Contributions

Code contributions are handled through GitHub Pull Requests.

The following guide lines will help you be consistent with the rest of the
project.

### Testing

All contributions must be tested. Add unit tests or leverage existing tests to
cover any new code you add.

Run `pnpm test` to ensure all tests pass.

Run `pnpm fuzz` to ensure your patch is robust. [Fuzz?](./fuzz/)

### Documentation

Documentation gets bugs just like code!

Changes may affect documentation even if they don't directly change the public
API. Any new parts of the public API should also be documented.

### Compatibility

This library targets modern JavaScript runtimes with support for ES2017 and
(optionally the `TextDecoder` DOM API), so restrict standard library usage to
those.

Additionally any functionality which is excessively difficult to polyfill or
reproduce should be avoided when possible. Stick to standard functions and avoid
any prototype trickery like `__proto__`, `Object.{set,get}PrototypeOf()` or
`Object.create`.

Avoid `null` prototype objects if you can, most of the time you want a `Map`
instead.

### Style Guide

This library follows the [Google JavaScript Style Guide], except it uses double
quotes `"` instead of single quotes `'` for regular strings.

That guide was intended for code targeting the Google Closure Compiler so ignore
anything which is not relevant for TypeScript or plain JavaScript.

[Google JavaScript Style Guide]:
https://google.github.io/styleguide/jsguide.html

#### Short Style Guide

- Always use UTF-8
- 2 spaces for indentation
- 80 character line limit
- `UpperCamelCase` for types and classes
- `camelCase` for functions, methods, properties and variables
- `UPPER_SNAKE_CASE` for enum variants and values intended to be constant
- Acronyms only have their first letter capitalized, e.g. `XMLParser` should
  instead be `XmlParser`
- Avoid getters and setters. Use a getter or setter method instead.
- No inheritance, not even for `Error`
- No enums on the public API, enums are specific to TypeScript and are generally
  not a good fit for JavaScript APIs
- Only use `undefined` instead of `null` internally but assume they are
  interchangeable when receiving values from the user, similar to the behavior
  of the optional chaining operator, which recognizes both `null` and
  `undefined` but produces `undefined` and not `null`
- Run `pnpm lint` to conform to the lint rules

#### Private Properties and Methods

ES2022 private class fields and methods are not used (the `#field` syntax).
TypeScript `private` is used instead and to reduce bundle size all private
properties and methods should be suffixed with `_` so that their identifiers
can be mangled by the build tool.

```ts
class MyClass {
  // @internal
  private doSomething_() {
    // ...
  }
}
```

## License

Any contributions you make will be under the same Apache-2.0 license that covers
the entire project.
