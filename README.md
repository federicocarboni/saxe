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
  },
  empty(name, attributes) {
  },
  end(name, attributes) {
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

## Security

XML Parsers may be subject to a number of possible vulnerabilities, most common
attacks exploit external entity resolution and entity expansion.

This parser is strictly non-validating, so by design it should not be vulnerable
to any XXE[^1] based attack. Additionally the length of strings collected during
parsing is capped to limit the efficacy of other denial-of-service attacks[^2].

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

[^1]: [XML External Entity (XXE) Processing OWASP | Foundation][xxe owasp]
[^2]: [XML Denial of Service Attacks and Defenses | Microsoft Learn][msdn xml dos]

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
