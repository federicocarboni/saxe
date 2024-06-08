# Saxe

Light-weight and efficient SAX parser for JavaScript (~5.87KB minified and gzipped).

## Goals

- Complete XML standard conformance
- Simple and terse API
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

Basic XML parsing is supported on any ES2017 runtime. Older runtimes can still
run `saxe` after transpilation and polyfilling any missing functionality.

Encoding support requires [`TextDecoder`]; most runtimes support it natively,
but it may be polyfilled.

## Document Type Declaration

Most[^1] JavaScript XML parsers skip Document Type Declarations (DTD) without
even checking for well-formedness or ignore most declarations.

This parser checks the whole internal DTD subset for well-formedness and
recognizes `ATTLIST` and `ENTITY` declarations, so attributes are normalized
appropriately and entities are expanded correctly. This process has [security
implications](#security); if the default behavior is undesirable it may be
changed.

Internal DTD subset parsing is required even for non-validating[^2] parsers.
External markup declarations and external entities are not supported and will
never be.

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

XML allows documents to specify their encoding through the XML or Text
Declarations.

```xml
<?xml version="1.0" encoding="UTF-8" ?>
```

Parsing XML from raw binary data in unknown encoding is supported by the
`SaxDecoder` class, which parses XML from `Uint8Array` chunks.

Do not use `SaxDecoder` when encoding information is provided externally, e.g.
`Content-Type` MIME type or another specification, e.g. EPUB specifies all XML
files MUST be `UTF-8`.

### Supported Encodings

`SaxDecoder` uses [`TextDecoder`] so it supports all encodings defined by the
[Encoding Standard].

A polyfill may only implement a subset of the [Encoding Standard § 4.
Encodings]. For full compliance ensure at least `UTF-8`
and `UTF-16` are supported, as they are required by the XML standard.

**Notes:**

- If a document specifies an unknown or unsupported encoding a
  `SaxError` with code `ENCODING_NOT_SUPPORTED` is thrown.
- If a document contains data which is invalid for the declared encoding a
  `SaxError` with code `ENCODING_INVALID_DATA` is thrown.

[`TextDecoder`]: https://developer.mozilla.org/en-US/docs/Web/API/TextDecoder
[Encoding Standard]: https://encoding.spec.whatwg.org/
[Encoding Standard § 4. Encodings]: https://encoding.spec.whatwg.org/#encodings

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

[^3]: [XML External Entity (XXE) Processing OWASP | Foundation][xxe owasp]
[^4]: [XML Denial of Service Attacks and Defenses | Microsoft Learn][msdn xml dos]

<!-- https://web.archive.org/web/20240515024616/https://owasp.org/www-community/vulnerabilities/XML_External_Entity_(XXE)_Processing -->
[xxe owasp]: https://owasp.org/www-community/vulnerabilities/XML_External_Entity_(XXE)_Processing
[msdn xml dos]: https://web.archive.org/web/20240318075117/https://learn.microsoft.com/en-us/archive/msdn-magazine/2009/november/xml-denial-of-service-attacks-and-defenses

## License

Copyright 2024 Federico Carboni

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

<http://www.apache.org/licenses/LICENSE-2.0>

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
