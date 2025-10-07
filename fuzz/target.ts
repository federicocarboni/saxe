import {SaxError, SaxParser} from "../src/index.ts";
import {CanonicalXmlWriter} from "../test/canonical_xml.ts";

export function fuzz(data: Buffer) {
  const str = data.toString("utf-8");
  const writer1 = new CanonicalXmlWriter();
  const writer2 = new CanonicalXmlWriter();
  const parser1 = new SaxParser(writer1);
  const parser2 = new SaxParser(writer2);
  let error1: SaxError | undefined;
  let error2: SaxError | undefined;
  try {
    parser1.write(str);
    parser1.end();
  } catch (error) {
    if (!(error instanceof SaxError)) {
      throw error;
    }
    error1 = error;
  }
  try {
    for (const c of str) {
      parser2.write(c);
    }
    parser2.end();
  } catch (error) {
    if (!(error instanceof SaxError)) {
      throw error;
    }
    error2 = error;
  }
  if (writer1.output !== writer2.output || error1?.code !== error2?.code) {
    throw new Error(
      `--- FULL: ---\n${writer1.output}\n${error1}\n\n--- CHAR BY CHAR: ---\n${writer2.output}\n${error2}`,
    );
  }
}
