import fs from "fs";
import path from "path";

import {expect, use} from "chai";
import chaiAsPromised from "chai-as-promised";
import {SaxParser} from "../src/index.ts";
import {CanonicalXmlWriter} from "./canonical_xml.ts";

use(chaiAsPromised);

const DATASET = [
  "lolz.xml",
  "quadratic_blowup.xml",
  "aaaaaa_attr.xml",
  "aaaaaa_cdata.xml",
  "aaaaaa_comment.xml",
  "aaaaaa_tag.xml",
  "aaaaaa_text.xml",
];

function testRecursive(data: string) {
  const parser = new SaxParser(new CanonicalXmlWriter());
  expect(() => {
    parser.write(data);
    parser.end();
  })
    .to.throw()
    .and.have.property("name", "RecursiveEntity");
}

describe("Large files", function() {
  for (const xmlFile of DATASET) {
    it(xmlFile, async function() {
      const parser = new SaxParser(new CanonicalXmlWriter(), {
        maxTextLength: 5_000_000,
      });
      expect(
        () => {
          parser.write(
            fs.readFileSync(path.join("test/data", xmlFile), "utf-8"),
          );
          parser.end();
        },
      )
        .to.throw()
        .and.have.property("name", "LimitExceeded");
    });
  }
  it("recursive.xml", function() {
    testRecursive(fs.readFileSync("test/data/recursive.xml", "utf-8"));
  });
  it("recursive2.xml", function() {
    testRecursive(fs.readFileSync("test/data/recursive2.xml", "utf-8"));
  });
});
