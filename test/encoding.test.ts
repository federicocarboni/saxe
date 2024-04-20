import {expect} from "chai";
import {SaxDecoder} from "../src/encoding.ts";
import {SaxParser} from "../src/index.ts";
import {CanonicalXmlWriter} from "./canonical_xml.ts";

const SHIFT_JIS_CONTENT = Buffer.from(
  "PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iU2hpZnRfSklTIj8+Cjxyb290PoNug42BW4FFg4+BW4OLg2g8L3Jvb3Q+Cg==",
  "base64",
);

describe("encoding", function() {
  it("decodes Shift_JIS file correctly", function() {
    const canonical = new CanonicalXmlWriter();
    const parser = new SaxParser(canonical);
    const decoder = new SaxDecoder(parser);
    decoder.write(SHIFT_JIS_CONTENT);
    decoder.end();
    expect(canonical.output).equals("<root>ハロー・ワールド</root>");
  });
});
