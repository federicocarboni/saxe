import {expect} from "chai";
import {Doctype, SaxParser, SaxReader} from "../src/index.ts";

class DoctypeDeclReader implements SaxReader {
  public doctypeDecl: Doctype | undefined;
  xml(): void {
    throw new Error("Method not implemented.");
  }
  doctype(doctype: Doctype): void {
    this.doctypeDecl = doctype;
  }
  pi(): void {
    throw new Error("Method not implemented.");
  }
  comment(): void {
    throw new Error("Method not implemented.");
  }
  replaceEntityRef(): string | undefined {
    throw new Error("Method not implemented.");
  }
  entityRef(): void {
    throw new Error("Method not implemented.");
  }
  start(): void {
    throw new Error("Method not implemented.");
  }
  empty(): void {
    throw new Error("Method not implemented.");
  }
  end(): void {
    throw new Error("Method not implemented.");
  }
  text(): void {
    throw new Error("Method not implemented.");
  }
}

function getDoctypeDecl(...chunks: string[]) {
  const docReader = new DoctypeDeclReader();
  const parser = new SaxParser(docReader);
  for (const chunk of chunks) {
    parser.write(chunk);
  }
  return docReader.doctypeDecl;
}

describe("doctypedecl", function() {
  it("wf: doctypedecl without ExternalID or intSubset", function() {
    expect(getDoctypeDecl("<!DOCTYPE doctypeName >"))
      .to.have.property("name", "doctypeName");
  });
  it("wf: doctypedecl with ExternalID and no intSubset", function() {
    expect(
      getDoctypeDecl('<!DOCTYPE doctypeName SYSTEM "-//DTD/something" >'),
    )
      .to.have.property("name", "doctypeName");
  });
  it("wf: doctypedecl with intSubset and no ExternalID", function() {
    expect(getDoctypeDecl(
      "<!DOCTYPE doctypeName [ <![IGNORE[  ]]> ] >",
    ))
      .to.have.property("name", "doctypeName");
  });
  it("wf: doctype with intSubset and ExternalID", function() {
    expect(
      getDoctypeDecl(
        '<!DOCTYPE doctypeName PUBLIC "/public/dtd" "-//DTD/something" [ <![IGNORE[  ]]> ] >',
      ),
    ).to.have.property("name", "doctypeName");
  });
  it("wf: doctype with intSubset and ExternalID quoted with apostrophes", function() {
    expect(
      getDoctypeDecl(
        "<!DOCTYPE doctypeName PUBLIC \"/public/dtd\" '-//DTD/something' [ <![IGNORE[  ]]> ] >",
      ),
    ).to.have.property("name", "doctypeName");
  });
  it("wf: DOCTYPE with an astral character name", function() {
    expect(getDoctypeDecl("<!DOCTYPE \u{1F000}\u{1F001}\u{1F002}>"))
      .to.have.property("name", "\u{1F000}\u{1F001}\u{1F002}");
  });
  it("wf: DOCTYPE with values split across chunks", function() {
    expect(
      getDoctypeDecl(
        "<!DOCTYPE  ",
        "doctyp",
        "eName ",
        ' PUBLIC "/public',
        '/dtd" "-//DTD/something" [ <![IGNORE[  ]]> ] >',
      ),
    ).to.have.property("name", "doctypeName");
  });
  it("not-wf: DOCTYPE with no name", function() {
    expect(() => getDoctypeDecl("<!DOCTYPE  >"))
      .to.throw().and.have.property("code", "INVALID_DOCTYPE_DECL");
  });
  it("not-wf: Invalid DOCTYPE start", function() {
    expect(() => getDoctypeDecl("<!DOCTYP doctypName >"))
      .to.throw().and.have.property("code", "INVALID_CDATA");
  });
});
