import {SaxParser} from "../src/index";

const utf8 = new TextEncoder();

describe("XML Declaration", () => {
  it("should do stuff", () => {
    const STUFF = '<?xml version="1.0" encoding="UTF-8" ?>';
    const chunk = utf8.encode(STUFF);
    const parser = new SaxParser(null as any);
    parser.write(chunk);
    parser.eof();
    console.log(parser);
  });
});
