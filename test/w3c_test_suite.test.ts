// XML Conformance Test Suite harness
// https://www.w3.org/XML/Test/

import {IGNORED_TEST_CASES} from "./ignored_test_cases.ts";
import {runTest, testCases} from "./w3c_test_suite/harness.ts";

describe("XML W3C Conformance Test Suite", function() {
  for (const [type, testCaseList] of testCases) {
    describe(type, function() {
      for (const testCase of testCaseList) {
        const it_ = IGNORED_TEST_CASES.includes(testCase.id) ? it.skip : it;
        it_(`${testCase.id}: ${testCase.description}`, runTest(testCase));
      }
    });
  }
});
