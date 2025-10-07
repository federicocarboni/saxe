import {expect} from "chai";
import {SaxDecoder} from "../src/encoding.ts";
import {SaxErrorCode, SaxParser} from "../src/index.ts";
import {CanonicalXmlWriter} from "./canonical_xml.ts";

// Contains the following string encoded in Shift_JIS
// "<?xml version="1.0" encoding="Shift_JIS"?>\n<root>ハロー・ワールド</root>\n"
const SHIFT_JIS_CONTENT = Buffer.from(
  "PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iU2hpZnRfSklTIj8+Cjxyb290PoNug42BW4FFg4+BW4OLg2g8L3Jvb3Q+Cg==",
  "base64",
);

function encodeUtf16(s: string, le: boolean) {
  const utf16 = new DataView(new ArrayBuffer(s.length * 2));
  for (let i = 0; i < s.length; i++) {
    utf16.setUint16(i * 2, s.charCodeAt(i), le);
  }
  return new Uint8Array(utf16.buffer);
}

function encodeUtf8(s: string) {
  return new TextEncoder().encode(s);
}

const UTF16LE_WITHOUT_BOM = encodeUtf16(
  '<?xml version="1.0" encoding="UTF-16LE"?>\n<root>ハロー・ワールド</root>\n',
  true,
);
const UTF16BE_WITHOUT_BOM = encodeUtf16(
  '<?xml version="1.0" encoding="UTF-16BE"?>\n<root>ハロー・ワールド</root>\n',
  false,
);
const UTF16LE_WITHOUT_BOM_INVALID_DECL = encodeUtf16(
  '<?xml version="1.0" encoding="US-ASCII"?>\n<root>ハロー・ワールド</root>\n',
  true,
);
const UTF16BE_WITHOUT_BOM_INVALID_DECL = encodeUtf16(
  '<?xml version="1.0" encoding="US-ASCII"?>\n<root>ハロー・ワールド</root>\n',
  false,
);

function decodes(data: Uint8Array, encoding: string, output: string) {
  const canonical = new CanonicalXmlWriter();
  const parser = new SaxParser(canonical);
  const decoder = new SaxDecoder(parser);
  for (const b of data) {
    decoder.write(new Uint8Array([b]));
  }
  decoder.end();
  expect(decoder.encoding).equals(encoding);
  expect(canonical.output).equals(output);
}

function decodeThrows(data: Uint8Array, code: SaxErrorCode, output: string) {
  const canonical = new CanonicalXmlWriter();
  const parser = new SaxParser(canonical);
  const decoder = new SaxDecoder(parser);
  expect(() => {
    for (const b of data) {
      decoder.write(new Uint8Array([b]));
    }
    decoder.end();
  })
    .to.throw()
    .and.have.property("code", code);
  expect(canonical.output).equals(output);
}

describe("encoding", function() {
  it("defaults to UTF-8 without BOM or declaration", function() {
    decodes(
      encodeUtf8("<root>ハロー・ワールド</root>"),
      "utf-8",
      "<root>ハロー・ワールド</root>",
    );
  });
  it("decodes UTF-8 with BOM", function() {
    decodes(
      encodeUtf8("\uFEFF<root>ハロー・ワールド</root>"),
      "utf-8",
      "<root>ハロー・ワールド</root>",
    );
  });
  it("decodes UTF-16LE with BOM", function() {
    decodes(
      encodeUtf16("\uFEFF<root>ハロー・ワールド</root>", true),
      "utf-16le",
      "<root>ハロー・ワールド</root>",
    );
  });
  it("decodes UTF-16BE with BOM", function() {
    decodes(
      encodeUtf16("\uFEFF<root>ハロー・ワールド</root>", false),
      "utf-16be",
      "<root>ハロー・ワールド</root>",
    );
  });
  it("decodes UTF-16LE without BOM", function() {
    decodes(
      encodeUtf16("<root>ハロー・ワールド</root>", true),
      "utf-16le",
      "<root>ハロー・ワールド</root>",
    );
  });
  it("decodes UTF-16BE without BOM", function() {
    decodes(
      encodeUtf16("<root>ハロー・ワールド</root>", false),
      "utf-16be",
      "<root>ハロー・ワールド</root>",
    );
  });
  it("decodes UTF-16LE without BOM with declaration", function() {
    decodes(
      encodeUtf16(
        '<?xml version="1.0" encoding="UTF-16"?><root>ハロー・ワールド</root>',
        true,
      ),
      "utf-16le",
      "<root>ハロー・ワールド</root>",
    );
  });
  it("decodes UTF-16BE without BOM with declaration", function() {
    decodes(
      encodeUtf16(
        '<?xml version="1.0" encoding="UTF-16BE"?><root>ハロー・ワールド</root>',
        false,
      ),
      "utf-16be",
      "<root>ハロー・ワールド</root>",
    );
  });
  it("decodes Shift_JIS from declaration", function() {
    decodes(SHIFT_JIS_CONTENT, "shift_jis", "<root>ハロー・ワールド</root>");
  });
});
