// XML Conformance Test Suite harness
// https://www.w3.org/XML/Test/

import {runTest, testCases} from "./w3c_test_suite/harness.ts";

describe("XML W3C Conformance Test Suite", function() {
  for (const [type, testCaseList] of testCases) {
    describe(type, async function() {
      for (const testCase of testCaseList) {
        runTest(testCase);
      }
    });
  }
});
