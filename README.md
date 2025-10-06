# Saxe

Light-weight and efficient SAX parser for JavaScript (~6.6KB minified and gzipped).

## Goals

- Complete XML standard conformance
- Simple and terse API
- Reduced code footprint
- Set a base for other standards built on XML, e.g. XHTML

## Example

```js
import {SaxParser} from "saxe";

let textContent = "";
const parser = new SaxParser({
  start(name, attributes) {
    // element start tag
  },
  empty(name, attributes) {
    // empty element
  },
  end(name, attributes) {
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
  polyfilling is enough.

- Encoding support: requires [`TextDecoder`]; most runtimes support it natively,
  but it can be polyfilled if not available.

## Document Type Declaration

Many[^1] JavaScript XML parsers skip DTDs without checking for well-formedness
or ignore most declarations.

Internal DTD subset parsing is required even for non-validating[^2] processors,
this parser implements the entire specification:

- Internal DTD subset is parsed and checked for well-formedness.
- `ATTLIST` and `ENTITY` declarations are recognized to normalize attributes and
  expand entities.

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

[lddubeau/saxes]: https://github.com/lddubeau/saxes
[isaacs/sax-js]: https://github.com/isaacs/sax-js
[NaturalIntelligence/fast-xml-parser]: https://github.com/NaturalIntelligence/fast-xml-parser
[xml proc types]: https://www.w3.org/TR/REC-xml/#proc-types

## Encoding Support

XML documents can specify their encoding through the XML or Text Declarations:

```xml
<?xml version="1.0" encoding="UTF-8" ?>
```

The SaxDecoder class supports parsing XML from `Uint8Array` chunks. Do not use
`SaxDecoder` when the encoding is specified externally (e.g. via `Content-Type`
or higher priority protocols).

### Supported Encodings

`SaxDecoder` uses [`TextDecoder`], supporting all encodings defined in the
[Encoding Standard]. If a polyfill is used, ensure at least `UTF-8` and `UTF-16`
decoders are supported.

[`TextDecoder`]: https://developer.mozilla.org/en-US/docs/Web/API/TextDecoder
[Encoding Standard]: https://encoding.spec.whatwg.org/

## Security

XML Parsers may be subject to a number of possible vulnerabilities, most common
attacks exploit external entity resolution and entity expansion.

This parser is strictly non-validating, so by design it should not be vulnerable
to any XXE[^3] based attack. Additionally the length of strings collected during
parsing is capped to limit the efficacy of other denial-of-service attacks[^4].

Document Type Declaration processing may (at user option) be disabled altogether
to prevent any attack based on them.

```js
// Doctype declarations will be rejected
// Alternatively, set to "ignore" to allow them but prevent
// them from affecting further parsing
new SaxParser(reader, {dtd: "prohibit"})
```

[Known XML Bombs](/test/data/) are tested for as part of regular integration
tests and the parser is [fuzz tested](/fuzz/) regularly. Despite this being the
case, for very sensible or security oriented apps you may want to conduct your
own security audit.

### Security Comparison Table

The following table provides an overview of the most common XML vulnerabilities
and whether comparable libraries are vulnerable to them.

This table is provided in the hope it be useful, it does not guarantee to be
exhaustive or to be kept up-to-date for any of the mentioned libraries.

| XML Parser                            | DTD retrieval | XXE[^3] | Billion laughs[^4] | Quadratic Blowup[^4] |
|---------------------------------------|---------------|---------|--------------------|----------------------|
| saxe                                  | Safe          | Safe    | Mitigated[^5]      | Mitigated[^5]        |
| saxe (dtd ignore)                     | Safe          | Safe    | Safe (entity)[^7]  | Safe (entity)[^7]    |
| [isaacs/sax-js]                       | Safe          | Safe    | Not applicable[^6] | Safe (entity)[^7]    |
| [lddubeau/saxes]                      | Safe          | Safe    | Not applicable[^6] | Safe (entity)[^7]    |
| [NaturalIntelligence/fast-xml-parser] | Safe          | Safe    | Not applicable[^6] | Throws RangeError    |

[^3]: [XML External Entity (XXE) Processing OWASP | Foundation][xxe owasp]
[^4]: [XML Denial of Service Attacks and Defenses | Microsoft Learn][msdn xml dos]
[^5]: Attack is mitigated against, crashes should be prevented, but depending on
  the attack it still may require more processing time than expected.
[^6]: Attack is prevented because entity expansion is not implemented or is not
  compliant.
[^7]: Safe assuming the user of the library does not define entities from
  untrusted values.

<!-- https://web.archive.org/web/20240515024616/https://owasp.org/www-community/vulnerabilities/XML_External_Entity_(XXE)_Processing -->
[xxe owasp]: https://owasp.org/www-community/vulnerabilities/XML_External_Entity_(XXE)_Processing
[msdn xml dos]: https://web.archive.org/web/20240318075117/https://learn.microsoft.com/en-us/archive/msdn-magazine/2009/november/xml-denial-of-service-attacks-and-defenses

## License

Licensed under the Apache License, Version 2.0. See the LICENSE file for
details.
