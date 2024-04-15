// XML Conformance Test Suite harness
// https://www.w3.org/XML/Test/

import {readFileSync} from "fs";
import path from "path";

import {expect} from "chai";

import {SaxParser, SaxReader} from "../src/index.ts";
import {IGNORED_TEST_CASES} from "./ignoredTestCases.ts";

function dataChar(value: string) {
  return value.replace(/[&<>"\t\n\r]/g, (val) => {
    switch (val) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "\t":
        return "&#9;";
      case "\n":
        return "&#10;";
      case "\r":
        return "&#13;";
    }
    return "";
  });
}

class CanonicalXmlWriter implements SaxReader {
  public output = "";
  // xml?(declaration: XmlDeclaration): void {
  //   throw new Error("Method not implemented.");
  // }
  // doctype?(doctype: Doctype): void {
  //   throw new Error("Method not implemented.");
  // }
  pi(target: string, content: string): void {
    this.output += `<?${target} ${content}?>`;
  }
  // comment(text: string): void {
  //   throw new Error("Method not implemented.");
  // }
  // replaceEntityRef?(entity: string): string | undefined {
  //   throw new Error("Method not implemented.");
  // }
  entityRef(entity: string): void {
    void entity;
    throw new Error("Method not implemented.");
  }
  start(name: string, attributes: ReadonlyMap<string, string>): void {
    this.output += `<${name}`;
    // As per canonical XML rule lexicographically sort attributes
    const attribs = [...attributes].sort(([a], [b]) => a < b ? -1 : 1);
    for (const [attribute, value] of attribs) {
      this.output += ` ${attribute}="${dataChar(value)}"`;
    }
    this.output += ">";
  }
  empty(name: string, attributes: ReadonlyMap<string, string>): void {
    this.start(name, attributes);
    this.end(name);
  }
  end(name: string): void {
    this.output += `</${name}>`;
  }
  text(text: string): void {
    this.output += dataChar(text);
  }
}

interface TestCase {
  id: string;
  uri: string;
  description: string;
  output: string | undefined;
}
class TestCaseReader implements SaxReader {
  testCases = new Map<string, TestCase[]>();
  private currentType: string | undefined = undefined;
  private currentUri: string | undefined = undefined;
  private currentId: string | undefined = undefined;
  private description = "";
  private output: string | undefined = undefined;
  entityRef(entity: string): void {
    void entity;
  }
  start(name: string, attributes: ReadonlyMap<string, string>): void {
    const sections = attributes.get("SECTIONS")!;
    if (
      name === "TEST" && attributes.get("ENTITIES") === "none" &&
      !/3\.3/.test(sections) &&
      !/4\.5/.test(sections)
    ) {
      this.currentType = attributes.get("TYPE");
      this.currentUri = attributes.get("URI");
      this.output = attributes.get("OUTPUT");
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
      // if (/entity/i.test(this.description)) {
      //   this.description = "";
      //   return;
      // }
      array.push({
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

const testCaseReader = new TestCaseReader();
const parser = new SaxParser(testCaseReader);

const xmltestContent = readFileSync("test/xmlts/xmltest/xmltest.xml", "utf-8");
parser.write(xmltestContent);
parser.end();

const testCases = testCaseReader.testCases;

function testCaseRunner(
  testContent: string,
  outputContent?: string,
  charByChar?: boolean,
) {
  return function() {
    const writer = new CanonicalXmlWriter();
    let isError = false;
    try {
      const parser = new SaxParser(writer);
      if (charByChar) {
        for (const c of testContent) {
          parser.write(c);
        }
      } else {
        parser.write(testContent);
      }
      parser.end();
    } catch {
      isError = true;
    }
    if (outputContent) {
      expect(writer.output).equals(outputContent);
    } else {
      expect(isError).to.be.true;
    }
  };
}

describe("W3C XML Conformance Test Suite", function() {
  for (const [typ, tests] of testCases) {
    tests.sort(({id: a}, {id: b}) => a < b ? -1 : 1);
    describe(typ, function() {
      for (const testCase of tests) {
        if (IGNORED_TEST_CASES.indexOf(testCase.id) !== -1) {
          continue;
        }
        const testPath = path.join("test/xmlts/xmltest", testCase.uri);
        const testContent = readFileSync(testPath, "utf-8");
        const outputContent = testCase.output
          ? readFileSync(
            path.join("test/xmlts/xmltest", testCase.output),
            "utf-8",
          )
          : undefined;
        it(
          testCase.id + ": char by char",
          testCaseRunner(testContent, outputContent, true),
        );
        it(
          testCase.id + ": large chunk",
          testCaseRunner(testContent, outputContent, false),
        );
      }
    });
  }
});
