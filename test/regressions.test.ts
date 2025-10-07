import {expect} from "chai";
import {SaxError, SaxParser} from "../src/index.ts";
import {CanonicalXmlWriter} from "./canonical_xml.ts";

// Found through fuzz testing
const REGRESSION000 = `<doc>
<a><![CDATA[xyz]]]\x01</a>
<![CDATA[]]></a>
\x02\x00doc>`;

describe("regressions", function() {
  it("regression 000: CDATA brackets", function() {
    const writer1 = new CanonicalXmlWriter();
    const writer2 = new CanonicalXmlWriter();
    const parser1 = new SaxParser(writer1);
    const parser2 = new SaxParser(writer2);
    let error1: SaxError | undefined = undefined;
    let error2: SaxError | undefined = undefined;
    try {
      parser1.write(REGRESSION000);
      parser1.end();
    } catch (error) {
      error1 = error;
    }
    try {
      for (const c of REGRESSION000) { parser2.write(c); }
      parser2.end();
    } catch (error) {
      error2 = error;
    }
    expect(error1).to.not.be.undefined;
    expect(error2).to.not.be.undefined;
    expect(error2!.code).equals(error1!.code);
    expect(writer2.output).equals(writer1.output);
  });
});
