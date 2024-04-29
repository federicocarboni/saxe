import {SaxParser} from "../src/index.ts";

describe("InternalSubset", function() {
  it("parses ENTITY declaration", function() {
    const parser = new SaxParser({
      start() {},
      empty(name, attributes) {
        console.log(name, attributes)
      },
      end() {
      },
      text() {
      },
    });
    parser.write('<!DOCTYPE example [ <!ATTLIST example hello ID "hello"> ]><example hello="   hell    hell2   " />');
    // console.log(parser.attlists_);
  });
});
