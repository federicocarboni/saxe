import {expect} from "chai";
import {SaxError} from "../src/error.ts";
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

describe("CDATA sections", function() {
  it("wf: CDATA section containing multiple brackets", function() {
    expect(toCanonical("<root><![CDATA[ [[[[[[[[]]]]]]]]]]></root>"))
      .equals("<root> [[[[[[[[]]]]]]]]</root>");
  });
  it("wf: CDATA section split across multiple chunks", function() {
    expect(
      toCanonical(
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
      .equals("<root>]]content]]content]]</root>");
  });
});
