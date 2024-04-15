import {isSaxError, SaxParser} from "../src/index.ts";

// TODO: add correctness test through Canonical XML
export function fuzz(data: Buffer) {
  const str = data.toString("utf-8");
  const saxParser = new SaxParser({
    pi() {},
    comment() {},
    entityRef() {},
    start() {},
    empty() {},
    end() {},
    text() {},
  });
  try {
    saxParser.write(str);
    saxParser.end();
  } catch (error) {
    if (!isSaxError(error)) {
      throw error;
    }
  }
}
