export const IGNORED_TEST_CASES = [
  // Encoding issues, either tests that are not UTF-8, or are invalid UTF-8
  "valid-sa-049",
  "valid-sa-050",
  "valid-sa-051",
  "not-wf-sa-168",
  "not-wf-sa-169",
  "not-wf-sa-170",
  "ibm-not-wf-P02-ibm02n30.xml",
  "ibm-not-wf-P02-ibm02n31.xml",
  "rmt-e2e-27",
  "rmt-e2e-61",
  "x-ibm-1-0.5-not-wf-P04-ibm04n22.xml",
  "x-ibm-1-0.5-not-wf-P04-ibm04n23.xml",
  "x-ibm-1-0.5-not-wf-P04a-ibm04an21.xml",
  "x-ibm-1-0.5-not-wf-P04-ibm04n21.xml",
  "x-ibm-1-0.5-not-wf-P04-ibm04n24.xml",
  "x-ibm-1-0.5-not-wf-P04a-ibm04an22.xml",
  "x-ibm-1-0.5-not-wf-P04a-ibm04an23.xml",
  "x-ibm-1-0.5-not-wf-P04a-ibm04an24.xml",

  // Validation of external ids is not implemented
  "o-p11pass1",

  // TODO: test expected output seems incorrect
  "ibm-valid-P02-ibm02v01.xml",

  // NOTATION declarations are currently not exposed by the parser
  "valid-sa-069",
  "valid-sa-076",
  "valid-sa-090",
  "valid-sa-091",
  "ibm-valid-P29-ibm29v01.xml",
  "ibm-valid-P54-ibm54v01.xml",
  "ibm-valid-P56-ibm56v08.xml",
  "ibm-valid-P57-ibm57v01.xml",
  "ibm-valid-P58-ibm58v01.xml",
  "ibm-valid-P58-ibm58v02.xml",
  "ibm-valid-P82-ibm82v01.xml",

  // Unparsed entity in entity value (validation)
  "rmt-e2e-55",

  // External entities
  "ibm-valid-P78-ibm78v01.xml",
  "invalid-bo-1",
  "invalid-bo-2",
  "invalid-bo-3",
  "invalid-bo-4",
  "invalid-bo-5",
  "invalid-bo-6",
  "rmt-e2e-22",
  // Parameter entities
  "ibm-invalid-P58-ibm58i01.xml",
  "ibm-invalid-P58-ibm58i02.xml",
  "ibm-not-wf-P69-ibm69n05.xml",
  "ibm-not-wf-P69-ibm69n06.xml",
  "ibm-not-wf-P69-ibm69n07.xml",
  "rmt-e3e-13",

  // xml:space is not implemented
  "rmt-e2e-57",

  // XML 1.1
  "rmt-e2e-50",

  // DTD validation
  "rmt-e2e-34",
];
