import {expect} from "chai";
import {toCanonical} from "./template.ts";

describe("text content", function() {
  it("allows '>'", function() {
    expect(toCanonical("<name>></name>")).equals("<name>&gt;</name>");
  });
  it("refuses ']]>'", function() {
    expect(() => toCanonical("<name>]]></name>")).throws();
    expect(() => toCanonical("<name>]]]]]]></name>")).throws();
  });
  it("refuses ']]>' with multiple precedin brackets", function() {
    expect(() => toCanonical("<name>]]></name>")).throws();
    expect(() => toCanonical("<name>]]]]]]></name>")).throws();
  });
  it("allows ']'", function() {
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
    expect(toCanonical("<root><![CDATA[", "]", "]", "content", "]]", "]]>", "content]", "]", "</root>"))
      .equals("<root>]]content]]content]]</root>");
  });
});
