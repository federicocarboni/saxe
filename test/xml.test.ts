import {SaxParser, SaxReader} from "../src/index.js";

describe("XML Declaration", function() {
  it("should do stuff", function() {
    const STUFF =
      '<?xml version="1.0" encoding="UTF-8" ?><!DOCTYPE something><element>CONTENT</element>';
    const parser = new SaxParser(
      {
        text(text) {
          console.log("text", text);
        },
        start(name, attributes) {
          console.log("start", name, attributes);
        },
        empty(name, attributes) {
          console.log("empty", name, attributes);
        },
        end(name) {
          console.log("end", name);
        },
      } satisfies SaxReader,
    );
    parser.write(STUFF);
    parser.end();
    // parser.eof();
    console.log(parser);
  });
});
