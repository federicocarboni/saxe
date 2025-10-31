import {expect} from "chai";
import type {EntityProvider, SaxOptions} from "../src/index.ts";
import {SaxError, SaxParser, xmlEscape} from "../src/index.ts";
import {CanonicalXmlWriter} from "./canonical_xml.ts";
import {toCanonicalOpt} from "./template.ts";

function testLimit(chunk: string, options?: SaxOptions) {
  expect(() => {
    const parser = new SaxParser(new CanonicalXmlWriter(), options);
    parser.parse(chunk);
  }).throws().instanceOf(SaxError).includes({name: "LimitExceeded"});
  expect(() => {
    const parser = new SaxParser(new CanonicalXmlWriter(), options);
    for (const c of chunk) {
      parser.parse(c, {stream: true});
    }
    parser.parse();
  }).throws().instanceOf(SaxError).includes({name: "LimitExceeded"});
  expect(() => {
    const parser = new SaxParser(new CanonicalXmlWriter(), {
      ...options,
      incompleteTextNodes: true,
    });
    parser.parse(chunk);
  }).throws().instanceOf(SaxError).includes({name: "LimitExceeded"});
  expect(() => {
    const parser = new SaxParser(new CanonicalXmlWriter(), {
      ...options,
      incompleteTextNodes: true,
    });
    for (const c of chunk) {
      parser.parse(c, {stream: true});
    }
    parser.parse();
  }).throws().instanceOf(SaxError).includes({name: "LimitExceeded"});
}

const LITERAL_ENTITIES: EntityProvider = {
  getEntity(name) {
    return xmlEscape(`&${name};`);
  },
};

// These tests expect parsing to throw when a limit is exceeded by 1 and to be
// successful when the limit is fully saturated but not exceeded.
describe("limits", function() {
  it("start tag name", function() {
    testLimit("<aaaaaaaaaaa></aaaaaaaaaaa>", {maxNameLength: 10});
    expect(toCanonicalOpt(["<aaaaaaaaaa></aaaaaaaaaa>"], {maxNameLength: 10}))
      .equals("<aaaaaaaaaa></aaaaaaaaaa>");
  });
  it("empty tag name", function() {
    testLimit("<aaaaaaaaaaa/>", {maxNameLength: 10});
    expect(toCanonicalOpt(["<aaaaaaaaaa/>"], {maxNameLength: 10}))
      .equals("<aaaaaaaaaa></aaaaaaaaaa>");
  });
  it("start tag attributes", function() {
    testLimit(
      '<a a="1" b="2" c="3" d="4" e="5" f="" ></a>',
      {maxAttributesLength: 10},
    );
    expect(
      toCanonicalOpt([
        '<a a="1" b="2" c="3" d="4" e="5"></a>',
      ], {maxAttributesLength: 10}),
    ).equals('<a a="1" b="2" c="3" d="4" e="5"></a>');
  });
  it("start tag default attributes", function() {
    testLimit(
      '<!DOCTYPE a [<!ATTLIST a k CDATA "">]><a a="" b="" c="" d="" e="" f="" g="" h="" i="" j=""></a>',
      {maxAttributesLength: 10},
    );
    expect(
      toCanonicalOpt([
        '<!DOCTYPE a [<!ATTLIST a j CDATA "">]><a a="" b="" c="" d="" e="" f="" g="" h="" i=""></a>',
      ], {maxAttributesLength: 10}),
    ).equals('<a a="" b="" c="" d="" e="" f="" g="" h="" i="" j=""></a>');
  });
  it("start tag attribute value", function() {
    testLimit('<a a="aaaaaaaaaaa"></a>', {maxTextLength: 10});
    expect(toCanonicalOpt(['<a a="aaaaaaaaaa"></a>'], {maxTextLength: 10}))
      .equals('<a a="aaaaaaaaaa"></a>');
  });
  it("start tag attribute value is checked before normalization", function() {
    testLimit(
      '<!DOCTYPE a [<!ATTLIST a a NMTOKEN #REQUIRED>]><a a=" aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"></a>',
      {maxTextLength: 32},
    );
    expect(
      toCanonicalOpt([
        '<!DOCTYPE a [<!ATTLIST a a NMTOKEN #REQUIRED>]><a a=" aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"></a>',
      ], {maxTextLength: 32}),
    ).equals('<a a="aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"></a>');
  });
  it("text", function() {
    testLimit("<a>aaaaaaaaaaa</a>", {maxTextLength: 10});
    expect(toCanonicalOpt(["<a>aaaaaaaaaa</a>"], {maxTextLength: 10}))
      .equals("<a>aaaaaaaaaa</a>");
  });
  it("CDATA section", function() {
    testLimit("<a><![CDATA[aaaaaaaaaaa]]></a>", {maxTextLength: 10});
    expect(
      toCanonicalOpt(["<a><![CDATA[aaaaaaaaaa]]></a>"], {maxTextLength: 10}),
    ).equals("<a>aaaaaaaaaa</a>");
  });
  it("CDATA section close brackets", function() {
    testLimit("<a><![CDATA[]]]]]]]]]]]]]></a>", {maxTextLength: 10});
    expect(
      toCanonicalOpt(["<a><![CDATA[]]]]]]]]]]]]></a>"], {maxTextLength: 10}),
    ).equals("<a>]]]]]]]]]]</a>");
  });
  it("comment", function() {
    testLimit("<a><!--aaaaaaaaaaa--></a>", {maxTextLength: 10});
    expect(toCanonicalOpt(["<a><!--aaaaaaaaaa--></a>"], {maxTextLength: 10}))
      .equals("<a></a>");
  });
  it("processing instruction target", function() {
    testLimit("<a><?aaaaaaaaaaa?></a>", {maxNameLength: 10});
    expect(toCanonicalOpt(["<a><?aaaaaaaaaa?></a>"], {maxNameLength: 10}))
      .equals("<a><?aaaaaaaaaa ?></a>");
  });
  it("processing instruction content", function() {
    testLimit("<a><?a aaaaaaaaaaa?></a>", {maxTextLength: 10});
    expect(toCanonicalOpt(["<a><?a aaaaaaaaaa?></a>"], {maxTextLength: 10}))
      .equals("<a><?a aaaaaaaaaa?></a>");
  });
  it("entity expansion depth", function() {
    testLimit(
      '<!DOCTYPE a [<!ENTITY a "&b;"><!ENTITY b "&c;"><!ENTITY c "&d;"><!ENTITY d "e">]><a>&a;</a>',
      {maxEntityDepth: 3},
    );
    expect(
      toCanonicalOpt([
        '<!DOCTYPE a [<!ENTITY a "&b;"><!ENTITY b "&c;"><!ENTITY c "d">]><a>&a;</a>',
      ], {maxEntityDepth: 3}),
    ).equals("<a>d</a>");
  });
  it("general entity ref name", function() {
    testLimit("<a>&aaaaaaaaaaa;</a>", {
      maxNameLength: 10,
      entityProvider: LITERAL_ENTITIES,
    });
    expect(
      toCanonicalOpt(["<a>&aaaaaaaaaa;</a>"], {
        maxNameLength: 10,
        entityProvider: LITERAL_ENTITIES,
      }),
    ).equals("<a>&amp;aaaaaaaaaa;</a>");
  });
  it("general entity decl name", function() {
    testLimit('<!DOCTYPE a [<!ENTITY aaaaaaaaaaa "a">]><a/>', {
      maxNameLength: 10,
    });
    expect(
      toCanonicalOpt(['<!DOCTYPE a [<!ENTITY aaaaaaaaaa "a">]><a/>'], {
        maxNameLength: 10,
      }),
    ).equals("<a></a>");
  });
  it("parameter entity ref name", function() {
    testLimit("<!DOCTYPE a [%aaaaaaaaaaa;]><a/>", {maxNameLength: 10});
    expect(
      toCanonicalOpt(["<!DOCTYPE a [%aaaaaaaaaa;]><a/>"], {
        maxNameLength: 10,
      }),
    ).equals("<a></a>");
  });
  it("parameter entity decl name", function() {
    testLimit('<!DOCTYPE a [<!ENTITY % aaaaaaaaaaa "a">]><a/>', {
      maxNameLength: 10,
    });
    expect(
      toCanonicalOpt(['<!DOCTYPE a [<!ENTITY % aaaaaaaaaa "a">]><a/>'], {
        maxNameLength: 10,
      }),
    ).equals("<a></a>");
  });
  it("DOCTYPE Public ID public", function() {
    testLimit('<!DOCTYPE a PUBLIC "aaaaaaaaaaa" "a"><a/>', {
      maxNameLength: 10,
    });
    expect(
      toCanonicalOpt(['<!DOCTYPE a PUBLIC "aaaaaaaaaa" "a"><a/>'], {
        maxNameLength: 10,
      }),
    ).equals("<a></a>");
  });
  it("DOCTYPE Public ID system", function() {
    testLimit('<!DOCTYPE a PUBLIC "a" "aaaaaaaaaaa"><a/>', {
      maxNameLength: 10,
    });
    expect(
      toCanonicalOpt(['<!DOCTYPE a PUBLIC "a" "aaaaaaaaaa"><a/>'], {
        maxNameLength: 10,
      }),
    ).equals("<a></a>");
  });
  it("DOCTYPE System ID", function() {
    testLimit('<!DOCTYPE a SYSTEM "aaaaaaaaaaa"><a/>', {
      maxNameLength: 10,
    });
    expect(
      toCanonicalOpt(['<!DOCTYPE a SYSTEM "aaaaaaaaaa"><a/>'], {
        maxNameLength: 10,
      }),
    ).equals("<a></a>");
  });
  it("XMLDecl", function() {
    testLimit(`<?xml version="1.0"${" ".repeat(1980)}?><a/>`);
    expect(
      toCanonicalOpt([`<?xml version="1.0"${" ".repeat(1979)}?><a/>`]),
    ).equals("<a></a>");
  });
});
