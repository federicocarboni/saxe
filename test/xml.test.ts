import {SaxParser} from "../src/index.js";

describe("XML Declaration", function() {
  it("should do stuff", function() {
    const STUFF = '<?xml version="1.0" encoding="UTF-8" ?>';
    const parser = new SaxParser({} as any);
    parser.write(STUFF);
    parser.end();
    // parser.eof();
    console.log(parser);
  });
});
