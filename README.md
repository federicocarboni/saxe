# Saxe

Light-weight and efficient SAX-style XML parser for JavaScript.

## Goals

- Full XML 1.0 standard conformance
- Simple and terse API
- Reduced code footprint
- Set a base for other standards built on XML (e.g. XHTML)

### Non-Goals

- XML DTD validation
- Full DOM implementation
- Syntax error tolerance
- Source code analysis or LSP features

## Example

```js
import {SaxParser} from "saxe";

let textContent = "";
const parser = new SaxParser({
  startTag(name, attributes) {
    // element start tag
  },
  emptyTag(name, attributes) {
    // element empty tag
  },
  endTag(name) {
    // element end tag
  },
  text(text) {
    textContent += text;
  },
});
for (const chunk of INPUT_STREAM) {
  parser.write(chunk);
}
parser.end();
```

## Runtime Support

- Basic XML parsing: any ES2017 runtime. For older runtimes transpiling and
  polyfilling should be enough.

## Document Type Declaration

Many[^1] JavaScript XML parsers simplify handling of the internal DTD subset,
either not checking for well-formedness or ignoring its declarations.

Internal DTD subset parsing is required even for non-validating[^2] processors,
this parser implements the entire specification:

- The internal DTD subset is parsed and checked for well-formedness.
- `ATTLIST` declarations are recognized to apply normalization and default
  values to attributes.
- `ENTITY` declarations are recognized to expand entity references.

This process has [security implications](#security); so if the default behavior
is undesirable it may be configured.

External markup declarations and external entities are not required for
non-validating[^2] processors and are explicitly not supported.

[^1]: Other JavaScript XML parser inspected include [isaacs/sax-js],
  [NaturalIntelligence/fast-xml-parser] and [lddubeau/saxes]
[^2]: Non-validating XML processors (parsers) do not validate documents, but
  must still recognize and report well-formedness (syntax) errors.
  Non-validating processors are not required to fetch and parse external markup
  declarations and external entities.
  [XML Standard § 5.1 Validating and Non-Validating Processors][xml proc types]
[^3]: [XML External Entity (XXE) Processing | OWASP Foundation][xxe owasp]
[^4]: [XML Denial of Service Attacks and Defenses | Microsoft Learn][msdn xml dos]

[lddubeau/saxes]: https://github.com/lddubeau/saxes
[isaacs/sax-js]: https://github.com/isaacs/sax-js
[NaturalIntelligence/fast-xml-parser]: https://github.com/NaturalIntelligence/fast-xml-parser
[xml proc types]: https://www.w3.org/TR/REC-xml/#proc-types

## Security

XML Parsers may be subject to a number of possible vulnerabilities, most common
attacks exploit external entity resolution and entity expansion.

This parser is strictly non-validating, so by design it should not be vulnerable
to any XXE[^3] based attack. Additionally the length of strings collected during
parsing is capped to limit the efficacy of other denial-of-service attacks[^4].

Document Type Declaration processing may (at user option) be disabled altogether
to prevent any attack based on them.

```js
new SaxParser(reader, {
  // Reject any DOCTYPE declaration
  dtd: "prohibit",

  // Alternatively, allow it but ignore any declarations
  // dtd: "ignore",

  // Enforce stricter limits over strings and values
  // collected during parsing.
  maxNameLength: 500,
  maxAttributes: 500,
  maxTextLength: 10000,
  maxEntityLength: 1000,
  maxEntityDepth: 5,
})
```

[Known XML Bombs](/test/data/) are tested for as part of regular integration
tests and the parser is [fuzz tested](/fuzz/) regularly. Despite this being the
case, for very sensible or security oriented apps you may want to conduct your
own security audit.

## License

Licensed under the Apache License, Version 2.0. See the LICENSE file for
details.
