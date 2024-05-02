import {expect} from "chai";
import {SaxParser} from "../src/index.ts";
import {toCanonical} from "./template.ts";

describe("InternalSubset", function() {
  it("parses ENTITY declaration", function() {
    const parser = new SaxParser({
      start(name, attributes) {
        console.log("start", name, attributes);
      },
      empty(name, attributes) {
        console.log("empty", name, attributes);
      },
      end(name) {
        console.log("end", name);
      },
      text(text) {
        console.log("text", JSON.stringify(text));
      },
    });
    parser.write(
      "<!DOCTYPE example [ <!ENTITY hello \"<hello hello='hello world'/>\"> ]><example>&hello;</example> ",
    );
  });
  it("wf: ATTLIST sets default values for attributes", function() {
    expect(
      toCanonical(
        '<!DOCTYPE example [<!ATTLIST root attribute CDATA "defaultValue">]><root/>',
      ),
    ).equals('<root attribute="defaultValue"></root>');
  });
  it("wf: tokenized attributes are normalized correctly", function() {
    expect(
      toCanonical(
        '<!DOCTYPE example [<!ATTLIST root attribute ID #IMPLIED>]><root attribute="  \r\n many \t\n so-many   \t very-many spaces \n\r "/>',
      ),
    ).equals('<root attribute="many so-many very-many spaces"></root>');
  });
});
