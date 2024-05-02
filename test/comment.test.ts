import {expect} from "chai";
import {SaxParser} from "../src/index.ts";

function getComment(...chunks: string[]) {
  let comment: string | undefined;
  const parser = new SaxParser({
    comment(text) {
      comment = text;
    },
    entityRef() {},
    start() {},
    empty() {},
    end() {},
    text() {},
  });
  for (const chunk of chunks) {
    parser.write(chunk);
  }
  parser.end();
  return comment;
}

describe("comment", function() {
  it("wf: comment in misc before root or DOCTYPE", function() {
    expect(getComment("<!-- comment --><root/>")).equals(" comment ");
  });
  it("wf: comment before DOCTYPE", function() {
    expect(getComment("<!-- comment --><!DOCTYPE root><root/>"))
      .equals(" comment ");
  });
  it("wf: comment before root", function() {
    expect(getComment("<!DOCTYPE root><!-- comment --><root/>"))
      .equals(" comment ");
  });
  it("wf: comment after root", function() {
    expect(getComment("<root/><!-- comment -->"))
      .equals(" comment ");
  });
  it("wf: comment in internal subset", function() {
    expect(getComment("<!DOCTYPE root [<!-- comment -->]><root/>"))
      .equals(" comment ");
  });
  it("wf: empty comment", function() {
    expect(getComment("<!----><root/>")).equals("");
  });
  it("wf: comment split across multiple chunks", function() {
    expect(getComment("<!-- comment", " ", "-", " -", "->", "<root/>"))
      .equals(" comment - ");
  });
  it("not-wf: comment with invalid start", function() {
    expect(() => getComment("<!-Hello--><root/>"))
      .to.throw().and.have.property("code", "INVALID_CDATA");
  });
  it("not-wf: comment with invalid character", function() {
    expect(() => getComment("<!--\uFFFF--><root/>"))
      .to.throw().and.have.property("code", "INVALID_CHAR");
  });
  it("not-wf: comment with '--'", function() {
    expect(() => getComment("<!-- comment -- comment --><root/>"))
      .to.throw().and.have.property("code", "INVALID_COMMENT");
  });
  it("not-wf: comment with '--' split across multiple chunks", function() {
    expect(() => getComment("<!-- comment -", "-", " comment --><root/>"))
      .to.throw().and.have.property("code", "INVALID_COMMENT");
  });
});
