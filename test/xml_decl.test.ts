import {expect} from "chai";
import {SaxParser, SaxReader, XmlDeclaration} from "../src/index.ts";

class XmlDeclReader implements SaxReader {
  declaration: XmlDeclaration | undefined = undefined;
  xml?(declaration: XmlDeclaration): void {
    this.declaration = declaration;
  }
  doctype?(): void {}
  pi?(): void {}
  comment?(): void {}
  replaceEntityRef?(): string | undefined {
    return undefined;
  }
  entityRef(): void {}
  start(): void {}
  empty(): void {}
  end(): void {}
  text(): void {}
}

function getXmlDecl(...chunks: string[]) {
  const reader = new XmlDeclReader();
  const parser = new SaxParser(reader);
  for (const chunk of chunks) {
    parser.write(chunk);
  }
  parser.end();
  return reader.declaration;
}

describe("XML Declaration", function() {
  it("not-wf: XMLDecl requires VersionInfo before EncodingDecl", function() {
    expect(() => getXmlDecl('<?xml encoding="UTF-8" ?>'))
      .to.throw().and.have.property("code", "INVALID_XML_DECL");
  });
  it("not-wf: XMLDecl requires VersionInfo before EncodingDecl or SDDecl", function() {
    expect(() => getXmlDecl('<?xml standalone="yes" ?>'))
      .to.throw().and.have.property("code", "INVALID_XML_DECL");
  });
  it("not-wf: XMLDecl requires EncodingDecl to be absent or precede SDDecl", function() {
    expect(() =>
      getXmlDecl('<?xml version="1.0" standalone="yes" encoding="UTF-8" ?>')
    )
      .to.throw().and.have.property("code", "INVALID_XML_DECL");
  });
  it("not-wf: XMLDecl requires space before EncodingDecl", function() {
    expect(() => getXmlDecl('<?xml version="1.0"encoding="UTF-8" ?>'))
      .to.throw().and.have.property("code", "INVALID_XML_DECL");
  });
  it("not-wf: XMLDecl requires space before SDDecl", function() {
    expect(() =>
      getXmlDecl('<?xml version="1.0" encoding="UTF-8"standalone="yes" ?>')
    )
      .to.throw().and.have.property("code", "INVALID_XML_DECL");
  });
  it("not-wf: XMLDecl VersionInfo may appear only once", function() {
    expect(() => getXmlDecl('<?xml version="1.0" version="1.0" ?>'))
      .to.throw().and.have.property("code", "INVALID_XML_DECL");
  });
  it("not-wf: XMLDecl EncodingDecl may appear only once", function() {
    expect(() =>
      getXmlDecl('<?xml version="1.0" encoding="UTF-8" encoding="UTF-8" ?>')
    )
      .to.throw().and.have.property("code", "INVALID_XML_DECL");
  });
  it("not-wf: XMLDecl SDDecl may appear only once", function() {
    expect(() =>
      getXmlDecl('<?xml version="1.0" standalone="yes" standalone="yes" ?>')
    )
      .to.throw().and.have.property("code", "INVALID_XML_DECL");
  });
  it("not-wf: XMLDecl VersionInfo must be quoted", function() {
    expect(() => getXmlDecl("<?xml version=1.0 ?>"))
      .to.throw().and.have.property("code", "INVALID_XML_DECL");
  });
  it("wf: XMLDecl VersionInfo may be quoted with apostrophe", function() {
    expect(getXmlDecl("<?xml version='1.0' ?><root/>"))
      .deep.equals({
        version: "1.0",
        encoding: undefined,
        standalone: undefined,
      });
  });
  it("wf: XMLDecl VersionInfo may have space before and after equals sign", function() {
    expect(getXmlDecl('<?xml version = "1.0" encoding = "UTF-8" ?><root/>'))
      .deep.equals({
        version: "1.0",
        encoding: "utf-8",
        standalone: undefined,
      });
  });
  it("not-wf: XMLDecl VersionNum must match production", function() {
    expect(() => getXmlDecl('<?xml version=" 1.0" ?>'))
      .to.throw().and.have.property("code", "INVALID_XML_DECL");
  });
  it("not-wf: XMLDecl EncodingDecl must be quoted", function() {
    expect(() => getXmlDecl('<?xml version="1.0" encoding=UTF-8 ?>'))
      .to.throw().and.have.property("code", "INVALID_XML_DECL");
  });
  it("wf: XMLDecl EncodingDecl may have space before and after equals sign", function() {
    expect(getXmlDecl('<?xml version="1.0" encoding = "UTF-8" ?><root/>'))
      .deep.equals({
        version: "1.0",
        encoding: "utf-8",
        standalone: undefined,
      });
  });
  it("wf: XMLDecl EncodingDecl may be quoted with apostrophe", function() {
    expect(getXmlDecl("<?xml version=\"1.0\" encoding='UTF-8' ?><root/>"))
      .deep.equals({
        version: "1.0",
        encoding: "utf-8",
        standalone: undefined,
      });
  });
  it("not-wf: XMLDecl EncName must match production", function() {
    expect(() => getXmlDecl('<?xml version="1.0" encoding=" UTF-8" ?>'))
      .to.throw().and.have.property("code", "INVALID_XML_DECL");
  });
  it("not-wf: XMLDecl SDDecl must be quoted", function() {
    expect(() => getXmlDecl('<?xml version="1.0" standalone=yes ?>'))
      .to.throw().and.have.property("code", "INVALID_XML_DECL");
  });
  it("wf: XMLDecl SDDecl may be quoted with apostrophe", function() {
    expect(getXmlDecl("<?xml version=\"1.0\" standalone='yes' ?><root/>"))
      .deep.equals({
        version: "1.0",
        encoding: undefined,
        standalone: true,
      });
  });
  it('wf: XMLDecl SDDecl may be "yes" or "no"', function() {
    expect(getXmlDecl("<?xml version=\"1.0\" standalone='yes' ?><root/>"))
      .deep.equals({
        version: "1.0",
        encoding: undefined,
        standalone: true,
      });
    expect(getXmlDecl("<?xml version=\"1.0\" standalone='no' ?><root/>"))
      .deep.equals({
        version: "1.0",
        encoding: undefined,
        standalone: false,
      });
  });
  it('not-wf: XMLDecl SDDecl may only be "yes" or "no"', function() {
    expect(() =>
      getXmlDecl("<?xml version=\"1.0\" standalone='value' ?><root/>")
    )
      .to.throw().and.have.property("code", "INVALID_XML_DECL");
  });
  it("not-wf: XMLDecl rejects unknown long pseudo-attributes", function() {
    expect(() => getXmlDecl('<?xml version="1.0" some-other-name="value" ?>'))
      .to.throw().and.have.property("code", "INVALID_XML_DECL");
  });
  it("not-wf: XMLDecl rejects unknown pseudo-attributes", function() {
    expect(() => getXmlDecl('<?xml version="1.0" other-name="value" ?>'))
      .to.throw().and.have.property("code", "INVALID_XML_DECL");
  });
  it("not-wf: XMLDecl ends at '?>' not '?'", function() {
    expect(() => getXmlDecl('<?xml version="1.0" ? >'))
      .to.throw().and.have.property("code", "INVALID_XML_DECL");
  });
  it("not-wf: XMLDecl ends at '?>' not '>'", function() {
    expect(() => getXmlDecl('<?xml version="1.0" >'))
      .to.throw().and.have.property("code", "UNEXPECTED_EOF");
  });
  it("wf: XMLDecl with value split across chunks", function() {
    expect(getXmlDecl('<?xml version="', "1.0", '"?><root/>'))
      .deep.equals({
        version: "1.0",
        encoding: undefined,
        standalone: undefined,
      });
  });
});
