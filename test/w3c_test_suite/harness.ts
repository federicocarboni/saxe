import * as fs from "fs";
import * as https from "https";
import * as path from "path";
import * as streams from "stream/promises";
import * as tar from "tar";

import {expect} from "chai";
import type {Attributes, SaxOptions, SaxReader} from "../../src/index.ts";
import {SaxError, SaxNamespaceParser, SaxParser} from "../../src/index.ts";
import {CanonicalXmlWriter} from "../canonical_xml.ts";
import {IGNORED_TEST_CASES} from "../ignored_test_cases.ts";

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
  private recommendation: string | undefined = undefined;
  constructor(
    public baseUri: string,
    public testCases = new Map<string, TestCase[]>(),
    public nsTestCases = new Map<string, TestCase[]>(),
  ) {}
  startTag(name: string, attributes: Attributes): void {
    if (
      name === "TEST" &&
      (!attributes.has("ENTITIES") ||
        // Only general entities are supported
        ["none", "general"].includes(attributes.get("ENTITIES")!)) &&
      // Filter out tests for previous editions
      (!attributes.has("EDITION") ||
        attributes.get("EDITION")!.split(" ").includes("5"))
    ) {
      this.currentType = attributes.get("TYPE");
      this.currentUri = path.join(this.baseUri, attributes.get("URI")!);
      this.output = attributes.has("OUTPUT")
        ? path.join(this.baseUri, attributes.get("OUTPUT")!)
        : undefined;
      const altOutput = path.join(
        path.dirname(this.currentUri),
        "out",
        path.basename(this.currentUri),
      );
      if (
        this.output === undefined &&
        fs.statSync(altOutput, {throwIfNoEntry: false})?.isFile()
      ) {
        this.output = altOutput;
      }
      this.currentId = attributes.get("ID");
      this.recommendation = attributes.get("RECOMMENDATION");
    }
  }
  endTag(name: string): void {
    if (
      name === "TEST" &&
      this.currentType !== undefined && this.currentUri !== undefined &&
      this.currentId !== undefined
    ) {
      const testCases = this.recommendation?.startsWith("NS1.0")
        ? this.nsTestCases
        : this.testCases;
      let array: TestCase[];
      if (!testCases.has(this.currentType)) {
        testCases.set(this.currentType, array = []);
      } else {
        array = testCases.get(this.currentType)!;
      }
      if (this.currentId === "ibm-not-wf-P88-ibm88n01.xml") {
        this.description =
          "Tests BaseChar with an illegal character. Illegal characters " +
          "occur as the first character of the PITarget in the PI in the DTD";
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
      this.recommendation = undefined;
      this.description = "";
    }
  }
  text(content: string): void {
    this.description += content;
  }
}

const testCases = new Map<string, TestCase[]>();
const nsTestCases = new Map<string, TestCase[]>();

async function getTestCases(xmlconf: string) {
  const testPath = path.join("xmlconf", xmlconf);
  const test = fs.createReadStream(testPath, "utf-8");
  const reader = new TestCaseReader(
    path.dirname(testPath),
    testCases,
    nsTestCases,
  );
  const parser = new SaxParser(reader);
  test.on("data", (data) => {
    try {
      parser.parse(data as string, {stream: true});
    } catch (error) {
      console.error(error, xmlconf);
      throw error;
    }
  });
  await streams.finished(test);
  parser.parse();
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
  "oasis/oasis.xml",
  // IBM tests
  "ibm/ibm_oasis_invalid.xml",
  "ibm/ibm_oasis_not-wf.xml",
  "ibm/ibm_oasis_valid.xml",
  // Edinburgh University tests
  "eduni/errata-2e/errata2e.xml",
  // "eduni/xml-1.1/xml11.xml",
  // "eduni/namespaces/1.1/rmt-ns11.xml",
  "eduni/errata-3e/errata3e.xml",
  "eduni/errata-4e/errata4e.xml",
  "eduni/namespaces/1.0/rmt-ns10.xml",
  "eduni/namespaces/errata-1e/errata1e.xml",
];

for (const xmlconf of TEST_SUITE) {
  await getTestCases(xmlconf);
}

function runTestWith(
  testCase: TestCase,
  toCanonical: (content: string, options?: SaxOptions) => void,
) {
  const it_ = IGNORED_TEST_CASES.includes(testCase.id)
    ? it.skip
    : it;
  it_(`${testCase.id}: ${testCase.description}`, async function() {
    const content = await fs.promises.readFile(testCase.uri, "utf-8");
    const output = testCase.output !== undefined
      ? await fs.promises.readFile(testCase.output, "utf-8")
      : undefined;

    expect(testCase.type).oneOf(["valid", "invalid", "not-wf", "error"]);

    if (testCase.type === "valid" || testCase.type === "invalid") {
      if (output !== undefined) {
        expect(toCanonical(content)).equals(output);
        expect(toCanonical(content, {incompleteTextNodes: true})).equals(
          output,
        );
      } else {
        toCanonical(content);
        toCanonical(content, {incompleteTextNodes: true});
      }
    } else if (testCase.type === "not-wf" || testCase.type === "error") {
      expect(() => toCanonical(content))
        .throws().and.is.instanceOf(SaxError);
      expect(() => toCanonical(content, {incompleteTextNodes: true}))
        .throws().and.is.instanceOf(SaxError);
    }
  });
}

export function runNsTest(testCase: TestCase) {
  runTestWith(testCase, (content, options) => {
    const parser = new SaxNamespaceParser({
      xmlDecl() {},
      doctype() {},
      comment() {},
      processingInstruction() {},
      startTag() {
      },
      endTag() {
      },
      entityRef() {
        return false;
      },
      text() {},
    }, {
      // IBM has some very long names in their tests
      maxNameLength: 5000,
      ...options,
    });
    for (const c of content!) {
      parser.parse(c, {stream: true});
    }
    parser.parse();
  });
}

export function runTest(testCase: TestCase) {
  runTestWith(testCase, (content, options) => {
    const canonicalizer = new CanonicalXmlWriter();
    const parser = new SaxParser(canonicalizer, {
      // IBM has some very long names in their tests
      maxNameLength: 5000,
      ...options,
    });
    for (const c of content!) {
      parser.parse(c, {stream: true});
    }
    parser.parse();
    return canonicalizer.output;
  });
}

export {nsTestCases, testCases};
