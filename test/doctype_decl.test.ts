import {expect} from "chai";
import {Doctype, SaxParser, SaxReader} from "../src/index.ts";

class DoctypeDeclReader implements SaxReader {
  public doctypeDecl: Doctype | undefined;
  doctype(doctype: Doctype): void {
    this.doctypeDecl = doctype;
  }
  entityRef() {}
  start() {}
  empty() {}
  end() {}
  text() {}
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
    ).deep.equals({
      name: "doctypeName",
      publicId: undefined,
      systemId: "-//DTD/something",
    });
  });
  it("wf: doctypedecl with intSubset and no ExternalID", function() {
    expect(getDoctypeDecl(
      "<!DOCTYPE doctypeName [  <!ENTITY name 'value'> ] >",
    ))
      .to.have.property("name", "doctypeName");
  });
  it("wf: doctypedecl with intSubset and ExternalID", function() {
    expect(
      getDoctypeDecl(
        '<!DOCTYPE doctypeName PUBLIC "/public/dtd" "-//DTD/something" [ <!ENTITY name "value"> ] >',
      ),
    ).deep.equals({
      name: "doctypeName",
      publicId: "/public/dtd",
      systemId: "-//DTD/something",
    });
  });
  it("wf: doctypedecl with intSubset and ExternalID quoted with apostrophes", function() {
    expect(
      getDoctypeDecl(
        "<!DOCTYPE doctypeName PUBLIC \"/public/dtd\" '-//DTD/something' [ <!ENTITY name 'value'> ] >",
      ),
    ).deep.equals({
      name: "doctypeName",
      publicId: "/public/dtd",
      systemId: "-//DTD/something",
    });
  });
  it("wf: doctypedecl with an astral character name", function() {
    expect(getDoctypeDecl("<!DOCTYPE \u{1F000}\u{1F001}\u{1F002}>"))
      .to.have.property("name", "\u{1F000}\u{1F001}\u{1F002}");
  });
  it("wf: doctypedecl with values split across chunks", function() {
    expect(
      getDoctypeDecl(
        "<!DOC",
        "TYPE  ",
        "doctyp",
        "eName ",
        " PUB",
        'LIC "/public',
        '/dtd"  ',
        ' "-//DTD/something" [ <!ENTITY name "value"> ] >',
      ),
    ).deep.equals({
      name: "doctypeName",
      publicId: "/public/dtd",
      systemId: "-//DTD/something",
    });
  });
  it("not-wf: doctypedecl with no name", function() {
    expect(() => getDoctypeDecl("<!DOCTYPE  >"))
      .to.throw().and.have.property("code", "INVALID_DOCTYPE_DECL");
  });
  it("not-wf: doctypedecl with invalid start", function() {
    expect(() => getDoctypeDecl("<!DOCTYP doctypName >"))
      .to.throw().and.have.property("code", "INVALID_CDATA");
  });
  it("not-wf: more than one doctypedecl", function() {
    expect(() =>
      getDoctypeDecl("<!DOCTYPE doctypeName ><!DOCTYPE doctypeName >")
    )
      .to.throw().and.have.property("code", "INVALID_DOCTYPE_DECL");
  });
  it("not-wf: doctypedecl after root element", function() {
    expect(() => getDoctypeDecl("<root/><!DOCTYPE doctypeName >"))
      .to.throw().and.have.property("code", "INVALID_DOCTYPE_DECL");
  });
  it("not-wf: doctypedecl with unquoted ExternalID", function() {
    expect(() => getDoctypeDecl("<!DOCTYPE doctypeName PUBLIC pubid><root/>"))
      .to.throw().and.have.property("code", "INVALID_DOCTYPE_DECL");
  });
  it("not-wf: doctypedecl with no space after Pubid", function() {
    expect(() =>
      getDoctypeDecl('<!DOCTYPE doctypeName PUBLIC "pubid""system"><root/>')
    )
      .to.throw().and.have.property("code", "INVALID_DOCTYPE_DECL");
  });
  it("not-wf: doctypedecl with invalid PubidChar", function() {
    expect(() =>
      getDoctypeDecl(
        '<!DOCTYPE doctypeName PUBLIC "{{pubid}}" "system"><root/>',
      )
    )
      .to.throw().and.have.property("code", "INVALID_DOCTYPE_DECL");
  });
  it("not-wf: doctypedecl with malformed ExternalID", function() {
    expect(() =>
      getDoctypeDecl('<!DOCTYPE doctypeName PUBLIK "pubid" "system"><root/>')
    )
      .to.throw().and.have.property("code", "INVALID_DOCTYPE_DECL");
  });
});
