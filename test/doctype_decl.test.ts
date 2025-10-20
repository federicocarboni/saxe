import {expect} from "chai";
import type {Doctype, SaxOptions, SaxReader} from "../src/index.ts";
import {SaxParser} from "../src/index.ts";

class DoctypeDeclReader implements SaxReader {
  public doctypeDecl: Doctype | undefined;
  doctype(doctype: Doctype): void {
    this.doctypeDecl = doctype;
  }
  startTag() {}
  endTag() {}
  text() {}
}

function getDoctypeDeclOpt(chunks: string[], options?: SaxOptions) {
  const docReader = new DoctypeDeclReader();
  const parser = new SaxParser(docReader, options);
  for (const chunk of chunks) {
    parser.parse(chunk, {stream: true});
  }
  return docReader.doctypeDecl;
}
function getDoctypeDecl(...chunks: string[]) {
  return getDoctypeDeclOpt(chunks);
}

describe("Document type declaration", function() {
  it("wf: doctypedecl without ExternalID or intSubset", function() {
    expect(getDoctypeDecl("<!DOCTYPE doctypeName >"))
      .to.has.property("name", "doctypeName");
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
      .to.has.property("name", "doctypeName");
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
      .to.has.property("name", "\u{1F000}\u{1F001}\u{1F002}");
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
      .throws().and.has.property("name", "InvalidDoctypeDecl");
  });
  it("not-wf: doctypedecl with invalid start", function() {
    expect(() => getDoctypeDecl("<!DOCTYP doctypName >"))
      .throws().and.has.property("name", "InvalidContent");
  });
  it("not-wf: more than one doctypedecl", function() {
    expect(() =>
      getDoctypeDecl("<!DOCTYPE doctypeName ><!DOCTYPE doctypeName >")
    )
      .throws().and.has.property("name", "InvalidDoctypeDecl");
  });
  it("not-wf: doctypedecl after root element", function() {
    expect(() => getDoctypeDecl("<root/><!DOCTYPE doctypeName >"))
      .throws().and.has.property("name", "InvalidDoctypeDecl");
  });
  it("not-wf: doctypedecl with unquoted ExternalID", function() {
    expect(() => getDoctypeDecl("<!DOCTYPE doctypeName PUBLIC pubid><root/>"))
      .throws().and.has.property("name", "InvalidDoctypeDecl");
  });
  it("not-wf: doctypedecl with no space after Pubid", function() {
    expect(() =>
      getDoctypeDecl('<!DOCTYPE doctypeName PUBLIC "pubid""system"><root/>')
    )
      .throws().and.has.property("name", "InvalidDoctypeDecl");
  });
  it("not-wf: doctypedecl with invalid PubidChar", function() {
    expect(() =>
      getDoctypeDecl(
        '<!DOCTYPE doctypeName PUBLIC "{{pubid}}" "system"><root/>',
      )
    )
      .throws().and.has.property("name", "InvalidDoctypeDecl");
  });
  it("not-wf: doctypedecl with malformed ExternalID", function() {
    expect(() =>
      getDoctypeDecl('<!DOCTYPE doctypeName PUBLIK "pubid" "system"><root/>')
    )
      .throws().and.has.property("name", "InvalidDoctypeDecl");
  });
  it('dtd: "prohibit": doctypedecl is rejected', function() {
    expect(() =>
      getDoctypeDeclOpt(["<!DOCTYPE doctypeName><root/>"], {dtd: "prohibit"})
    )
      .throws().and.has.property("name", "InvalidDoctypeDecl");
  });
});
