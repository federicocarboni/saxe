import {expect} from "chai";
import {xmlEscape, xmlEscapeChar} from "../src/index.ts";

describe("xmlEscape", function() {
  it("escapes XML markup characters", function() {
    expect(xmlEscape(`&<>'"\t\n\r `)).equals(
      "&amp;&lt;&gt;&apos;&quot;&#9;&#10;&#13; ",
    );
  });
});

describe("xmlEscapeChar", function() {
  it("escapes all characters", function() {
    const input = `&<>'"\t\n\r 😀!`;
    let output = "";
    for (const c of [...input]) {
      output += xmlEscapeChar(c);
    }
    expect(output).equals(
      "&amp;&lt;&gt;&apos;&quot;&#9;&#10;&#13;&#32;&#128512;&#33;",
    );
  });
  it("behaves appropriately on invalid input", function() {
    expect(xmlEscapeChar("&foo")).equals("&amp;");
    expect(xmlEscapeChar("😀foo")).equals("&#128512;");
    expect(xmlEscapeChar("")).equals("");
  });
});
