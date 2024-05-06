import {expect} from "chai";
import {toCanonical} from "./template.ts";

describe("Attribute-list Declaration", function() {
  it("wf: ATTLIST is ignored after a parameter entity", function() {
    expect(
      toCanonical(
        "<!DOCTYPE example [" +
          '<!ENTITY % e "">' +
          "%e;" +
          '<!ATTLIST root foo CDATA "bar">' +
          "]><root/>",
      ),
    ).equals("<root></root>");
  });
  it("wf: ATTLIST is not ignored after a parameter entity when standalone='yes'", function() {
    expect(
      toCanonical(
        '<?xml version="1.0" standalone="yes"?>' +
          "<!DOCTYPE example [" +
          '<!ENTITY % e "">' +
          "%e;" +
          '<!ATTLIST root foo CDATA "bar">' +
          "]><root/>",
      ),
    ).equals('<root foo="bar"></root>');
  });
  it("wf: ATTLIST sets default values for attributes", function() {
    expect(
      toCanonical(
        '<!DOCTYPE example [<!ATTLIST root attribute CDATA "defaultValue">]><root/>',
      ),
    ).equals('<root attribute="defaultValue"></root>');
  });
  it("wf: ATTLIST tokenized type attributes are normalized correctly", function() {
    expect(
      toCanonical(
        '<!DOCTYPE example [<!ATTLIST root attribute2 CDATA #IMPLIED attribute ID #IMPLIED>]><root attribute="  \r\n many \t\n so-many   \t very-many spaces \n\r "/>',
      ),
    ).equals('<root attribute="many so-many very-many spaces"></root>');
  });
  it("wf: ATTLIST enumerated type attributes are normalized correctly", function() {
    expect(
      toCanonical(
        '<!DOCTYPE example [<!ATTLIST root foo ( bar | baz ) #IMPLIED>]><root foo="  \r\n bar \t\n baz    \n\r "/>',
      ),
    ).equals('<root foo="bar baz"></root>');
  });
  it("wf: ATTLIST notation type attribute default value is recognized", function() {
    expect(
      toCanonical(
        '<!DOCTYPE doc [ <!ATTLIST doc foo NOTATION ( bar | baz | boo ) "baz">]><doc></doc>',
      ),
    ).equals('<doc foo="baz"></doc>');
  });
});

describe("Entity Declaration", function() {
  it("wf: entity declaration is ignored after parameter entity reference", function() {
    expect(() =>
      toCanonical(
        "<!DOCTYPE doc [" +
          "%something;" +
          '<!ENTITY foo "&amp;">' +
          "]><doc>&foo;</doc>",
      )
    ).to.throw().and.have.property("code", "UNDECLARED_ENTITY");
  });
  it("wf: entity declaration is recognized after parameter entity reference when standalone='yes'", function() {
    expect(
      toCanonical(
        '<?xml version="1.0" standalone="yes" ?><!DOCTYPE doc [ %something; <!ENTITY foo "&amp;">]><doc>&foo;</doc>',
      ),
    ).equals("<doc>&amp;</doc>");
  });
  it("not-wf: external entity reference in attribute", function() {
    expect(() =>
      toCanonical(
        '<!DOCTYPE doc [ <!ENTITY foo SYSTEM "./foo.ent">]><doc attribute="&foo;"></doc>',
      )
    ).to.throw().and.have.property("code", "EXTERNAL_ENTITY");
  });
  it("not-wf: unparsed entity reference in attribute", function() {
    expect(() =>
      toCanonical(
        '<!DOCTYPE doc [ <!ENTITY foo SYSTEM "./foo.ent" NDATA foo>]><doc attribute="&foo;"></doc>',
      )
    ).to.throw().and.have.property("code", "UNPARSED_ENTITY");
  });
  it("not-wf: unparsed entity reference in content", function() {
    expect(() =>
      toCanonical(
        '<!DOCTYPE doc [ <!ENTITY foo SYSTEM "./foo.ent" NDATA foo>]><doc>&foo;</doc>',
      )
    ).to.throw().and.have.property("code", "UNPARSED_ENTITY");
  });
});
