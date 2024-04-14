import {isSaxError, SaxParser} from "../src/index.ts";

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
