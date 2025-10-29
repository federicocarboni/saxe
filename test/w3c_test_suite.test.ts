// XML Conformance Test Suite harness
// https://www.w3.org/XML/Test/

import {
  nsTestCases,
  runNsTest,
  runTest,
  testCases,
} from "./w3c_test_suite/harness.ts";

describe("XML W3C Conformance Test Suite", function() {
  for (const [type, testCaseList] of testCases) {
    describe(type, async function() {
      for (const testCase of testCaseList) {
        runTest(testCase);
      }
    });
  }
  for (const [type, testCaseList] of nsTestCases) {
    describe(`NS1.0 ${type}`, async function() {
      for (const testCase of testCaseList) {
        runNsTest(testCase);
      }
    });
  }
});
