import {expect} from "chai";
import {SaxParser} from "../src/index.ts";

function getPi(...chunks: string[]) {
  let pi: {
    target: string;
    content: string;
  } | undefined;
  const parser = new SaxParser({
    processingInstruction(target, content) {
      pi = {target, content};
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
  return pi;
}

describe("processing instruction", function() {
  it("wf: processing instruction in canonical form", function() {
    expect(getPi("<?target content?><root/>")).deep.equals({
      target: "target",
      content: "content",
    });
  });
  it("wf: processing instruction with extra starting spaces", function() {
    expect(getPi("<?target     content?><root/>")).deep.equals({
      target: "target",
      content: "content",
    });
  });
  it("wf: processing instruction with empty content", function() {
    expect(getPi("<?target?><root/>")).deep.equals({
      target: "target",
      content: "",
    });
  });
  it("wf: processing instruction with spaces before empty content", function() {
    expect(getPi("<?target  ?><root/>")).deep.equals({
      target: "target",
      content: "",
    });
  });
  it("wf: processing instruction with spaces after content", function() {
    expect(getPi("<?target content  ?><root/>")).deep.equals({
      target: "target",
      content: "content  ",
    });
  });
  it("wf: processing instruction with a question mark in content", function() {
    expect(getPi("<?target content?", "  ?><root/>")).deep.equals({
      target: "target",
      content: "content?  ",
    });
  });
  it("wf: processing instruction split across multiple chunks", function() {
    expect(getPi("<?target", " ", "content", " ", "?", ">", "<root/>"))
      .deep.equals({
        target: "target",
        content: "content ",
      });
  });
  it("wf: processing instruction in internal subset", function() {
    expect(getPi("<!DOCTYPE root [<?target content?>]><root/>")).deep.equals({
      target: "target",
      content: "content",
    });
  });
  it("not-wf: processing instruction with invalid character in name", function() {
    expect(() => getPi("<?target! ?><root/>"))
      .to.throw().and.have.property("code", "INVALID_PI");
  });
  it("not-wf: processing instruction with empty content and invalid end sequence", function() {
    expect(() => getPi("<?target?<root/>"))
      .to.throw().and.have.property("code", "INVALID_PI");
  });
  it("not-wf: processing instruction with reserved name", function() {
    expect(() => getPi("<?xML ?><root/>"))
      .to.throw().and.have.property("code", "RESERVED_PI");
  });
});
