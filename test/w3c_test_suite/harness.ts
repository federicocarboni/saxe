import * as fs from "fs";
import * as https from "https";
import * as path from "path";
import * as streams from "stream/promises";
import * as tar from "tar";

import {expect} from "chai";
import {SaxParser, SaxReader} from "../../src/index.ts";
import {CanonicalXmlWriter} from "../canonical_xml.ts";

// Download and extract the test suite
const XML_W3C_TEST_SUITE = "https://www.w3.org/XML/Test/xmlts20130923.tar.gz";
const TEST_SUITE_ARCHIVE = "xmlts20130923.tar.gz";

async function getTestSuite() {
  try {
    const stat = await fs.promises.stat("xmlconf/xmlconf.xml");
    // Skip downloading and extracting if the files are available
    if (stat.isFile()) {
      return;
    }
  } catch {
    // empty
  }
  const file = fs.createWriteStream(TEST_SUITE_ARCHIVE);
  const res = https.get(XML_W3C_TEST_SUITE, (res) => {
    res.pipe(file);
  });
  await streams.finished(res);
  file.close();

  await tar.extract({
    file: TEST_SUITE_ARCHIVE,
  });
  await fs.promises.unlink(TEST_SUITE_ARCHIVE);
}

await getTestSuite();

interface TestCase {
  type: string;
  id: string;
  uri: string;
  description: string;
  output: string | undefined;
}

class TestCaseReader implements SaxReader {
  private currentType: string | undefined = undefined;
  private currentUri: string | undefined = undefined;
  private currentId: string | undefined = undefined;
  private description = "";
  private output: string | undefined = undefined;
  constructor(
    public baseUri: string,
    public testCases = new Map<string, TestCase[]>(),
  ) {}
  entityRef(entity: string): void {
    void entity;
  }
  start(name: string, attributes: ReadonlyMap<string, string>): void {
    if (name === "TEST" && attributes.get("ENTITIES") === "none") {
      this.currentType = attributes.get("TYPE");
      this.currentUri = path.join(this.baseUri, attributes.get("URI")!);
      this.output = attributes.has("OUTPUT") ? path.join(this.baseUri, attributes.get("OUTPUT")!) : undefined;
      this.currentId = attributes.get("ID");
    }
  }
  empty(name: string, attributes: ReadonlyMap<string, string>): void {
    void name;
    void attributes;
  }
  end(name: string): void {
    if (
      name === "TEST" &&
      this.currentType !== undefined && this.currentUri !== undefined &&
      this.currentId !== undefined
    ) {
      let array: TestCase[];
      if (!this.testCases.has(this.currentType)) {
        this.testCases.set(this.currentType, array = []);
      } else {
        array = this.testCases.get(this.currentType)!;
      }
      array.push({
        type: this.currentType,
        id: this.currentId,
        uri: this.currentUri,
        description: this.description.trim().replace(/[ \t\n\r]+/g, " ")
          .replace(/\.$/, ""),
        output: this.output,
      });
      this.currentType = undefined;
      this.currentUri = undefined;
      this.currentId = undefined;
      this.output = undefined;
      this.description = "";
    }
  }
  text(text: string): void {
    this.description += text;
  }
}

const testCases = new Map<string, TestCase[]>();

async function getTestCases(xmlconf: string) {
  const testPath = path.join("xmlconf", xmlconf);
  const test = fs.createReadStream(testPath, "utf-8");
  const reader = new TestCaseReader(path.dirname(testPath), testCases);
  const parser = new SaxParser(reader);
  test.on("data", (data) => {
    try {
      parser.write(data as string);
    } catch (error) {
      console.error(error, xmlconf);
      throw error;
    }
  });
  await streams.finished(test);
  parser.end();
}

const TEST_SUITE = [
  // James Clark "XMLTEST"
  "xmltest/xmltest.xml",
  // Sun-written testcases
  // "sun/sun-valid.xml",
  // "sun/sun-invalid.xml",
  // "sun/sun-not-wf.xml",
  // "sun/sun-error.xml",
  // Fuji Xerox "Japanese Documents"
  // "japanese/japanese.xml",
  // NIST/OASIS test suite
  // "oasis/oasis.xml",
  // IBM tests
  // "ibm/ibm_oasis_invalid.xml",
  // "ibm/ibm_oasis_not-wf.xml",
  // "ibm/ibm_oasis_valid.xml",
];

for (const xmlconf of TEST_SUITE) {
  await getTestCases(xmlconf);
}

export function runTest(testCase: TestCase) {
  return async function() {
    if (testCase.id === "valid-sa-090") {
      console.log(testCase)
    }
    // TODO: not all files are utf-8!
    const content = await fs.promises.readFile(testCase.uri, "utf-8");
    const output = testCase.output !== undefined
      ? await fs.promises.readFile(testCase.output, "utf-8")
      : undefined;
    const toCanonical = () => {
      const canonicalizer = new CanonicalXmlWriter();
      const parser = new SaxParser(canonicalizer);
      parser.write(content);
      parser.end();
      return canonicalizer.output;
    };

    if (testCase.type === "valid") {
      expect(toCanonical()).equals(output);
    } else if (testCase.type === "not-wf") {
      expect(toCanonical)
        .to.throw().and.have.property("name", "SaxError");
    }
  };
}

export {testCases};
