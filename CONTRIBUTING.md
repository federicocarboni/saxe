#

Saxe uses the Google TypeScript style guide, with only one exception.

## Private properties and methods

Hash-prefixed properties and methods `#prop` are not used, so TypeScript `private` is used instead, to reduce bundle size all private properties and methods should be prefixed with `_` so that they can be mangled by the build tool.

## In short

- Always UTF-8.
- `UpperCamelCase` for types and classes.
- `camelCase` for functions, methods, properties and variables.
- Acronyms only have their first letter capitalized, e.g. `XMLParser` should instead be `XmlParser`.
- `UPPER_SNAKE_CASE` for enum variants and values intended to be constant.
- Avoid getters and setters. When that functionality is needed use methods instead.
- No inheritance. Not even for `Error`s.

### Compatibility

This library targets modern JavaScript runtimes with support for ES2017 and the `TextDecoder` DOM API. Other than that avoid any weird prototype hacks (`__proto__` is banned, together with `Object.{set,get}PrototypeOf()`) and non portable runtime specific functionality.
