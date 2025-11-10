import {expect} from "chai";
import {SaxError} from "../src/error.ts";
import type {SaxLexicalHandler} from "../src/index.ts";
import {SaxParser} from "../src/index.ts";
import {CanonicalXmlWriter} from "./canonical_xml.ts";
import {toCanonical} from "./template.ts";

describe("tags", function() {
  it("wf: regular start tag end tag", function() {
    expect(toCanonical("<name></name>")).equals("<name></name>");
  });
  it("wf: empty tag", function() {
    expect(toCanonical("<name />")).equals("<name></name>");
    expect(toCanonical("<name/>")).equals("<name></name>");
  });
  it("not-wf: space before name", function() {
    expect(() => toCanonical("< name></name>")).throws().instanceOf(SaxError)
      .includes({name: "InvalidStartTag"});
  });
});

describe("attributes", function() {
  it("wf: regular attributes", function() {
    expect(toCanonical('<name attr="value"></name>')).equals(
      '<name attr="value"></name>',
    );
  });
  it("wf: attributes in empty tag", function() {
    expect(toCanonical('<name attr="value"/>')).equals(
      '<name attr="value"></name>',
    );
    expect(toCanonical('<name attr="value" />')).equals(
      '<name attr="value"></name>',
    );
  });
  it("wf: space before =", function() {
    expect(toCanonical("<name attr ", " ", '="value"/>')).equals(
      '<name attr="value"></name>',
    );
  });
  it("wf: space after =", function() {
    expect(toCanonical('<name attr= "value"/>')).equals(
      '<name attr="value"></name>',
    );
  });
  it("wf: space before and after =", function() {
    expect(toCanonical('<name attr = "value"/>')).equals(
      '<name attr="value"></name>',
    );
  });
  it("not-wf: no =", function() {
    expect(() => toCanonical('<name attr "value"/>'))
      .throws()
      .instanceOf(SaxError)
      .includes({name: "InvalidStartTag"});
  });
});

describe("text content", function() {
  it("wf: allows '>'", function() {
    expect(toCanonical("<name>></name>")).equals("<name>&gt;</name>");
  });
  it("not-wf: refuses ']]>'", function() {
    expect(() => toCanonical("<name>]]></name>")).throws();
    expect(() => toCanonical("<name>]]]]]]></name>")).throws();
  });
  it("not-wf: refuses ']]>' with multiple precedin brackets", function() {
    expect(() => toCanonical("<name>]]></name>")).throws();
    expect(() => toCanonical("<name>]]]]]]></name>")).throws();
  });
  it("wf: allows ']'", function() {
    expect(toCanonical("<root>]]]]<name>></name></root>")).equals(
      "<root>]]]]<name>&gt;</name></root>",
    );
  });
});

class CDataCanonicalXml extends CanonicalXmlWriter
  implements SaxLexicalHandler
{
  private isCData = false;
  startCDataSection(): void {
    this.output += "<![CDATA[";
    this.isCData = true;
  }
  override text(content: string): void {
    if (this.isCData) {
      this.output += content;
    } else {
      super.text(content);
    }
  }
  endCDataSection(): void {
    this.output += "]]>";
    this.isCData = false;
  }
}

function toCDataCanonical(...chunks: string[]) {
  const handler = new CDataCanonicalXml();
  const parser = new SaxParser(handler);
  for (const chunk of chunks) {
    parser.parse(chunk, {stream: true});
  }
  parser.parse();
  return handler.output;
}

describe("CDATA sections", function() {
  it("wf: CDATA section containing multiple brackets", function() {
    expect(toCDataCanonical("<root><![CDATA[ [[[[[[[[]]]]]]]]]]></root>"))
      .equals("<root><![CDATA[ [[[[[[[[]]]]]]]]]]></root>");
  });
  it("wf: CDATA section split across multiple chunks", function() {
    expect(
      toCDataCanonical(
        "<root><![CDATA[",
        "]",
        "]",
        "content",
        "]]",
        "]]>",
        "content]",
        "]",
        "</root>",
      ),
    )
      .equals("<root><![CDATA[]]content]]]]>content]]</root>");
  });
});
