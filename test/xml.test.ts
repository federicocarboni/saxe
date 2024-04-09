import {SaxParser, SaxReader} from "../src/index.js";

describe("XML Declaration", function() {
  it("should do stuff", function() {
    const STUFF =
      '<?xml version="1.0" encoding="UTF-8"?><?target content?><!-- hel\rlo\r\n --><element hello="\thell\r">content&amp;</element>';
    const parser = new SaxParser(
      {
        xml(declaration) {
          console.log(
            "XMLDecl",
            JSON.stringify(declaration),
          );
        },
        comment(text) {
          console.log("comment", JSON.stringify(text));
        },
        pi(pi) {
          console.log("pi", JSON.stringify(pi));
        },
        text(text) {
          console.log("text", JSON.stringify(text));
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
      {
        incompleteTextNodes: true,
        maxEntityLength: 200,
      },
    );
    for (const c of STUFF) {
      parser.write(c);
    }
    parser.end();
    // parser.eof();
    console.log(parser);
  });
});
