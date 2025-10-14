import {SaxError, SaxParser} from "../src/index.ts";
import {CanonicalXmlWriter} from "../test/canonical_xml.ts";

export function fuzz(data: Buffer) {
  const str = data.toString("utf-8");
  const writer1 = new CanonicalXmlWriter();
  const writer2 = new CanonicalXmlWriter();
  const parser1 = new SaxParser(writer1, {incompleteTextNodes: true});
  const parser2 = new SaxParser(writer2, {incompleteTextNodes: true});
  let error1: SaxError | undefined;
  let error2: SaxError | undefined;
  try {
    parser1.parse(str);
  } catch (error) {
    if (!(error instanceof SaxError)) {
      throw error;
    }
    error1 = error;
  }
  try {
    for (const c of str) {
      parser2.parse(c, {stream: true});
    }
    parser2.parse();
  } catch (error) {
    if (!(error instanceof SaxError)) {
      throw error;
    }
    error2 = error;
  }
  if (
    error1?.name !== error2?.name ||
    error1 === undefined && writer1.output !== writer2.output
  ) {
    throw new Error(
      `--- FULL: ---\n${writer1.output}\n${error1}\n\n--- CHAR BY CHAR: ---\n${writer2.output}\n${error2}`,
    );
  }
}
