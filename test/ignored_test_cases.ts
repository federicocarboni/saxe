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

  // External entities
  "ibm-valid-P78-ibm78v01.xml",
  // Parameter entities
  "ibm-invalid-P58-ibm58i01.xml",
  "ibm-invalid-P58-ibm58i02.xml",
  "ibm-not-wf-P69-ibm69n05.xml",
  "ibm-not-wf-P69-ibm69n06.xml",
  "ibm-not-wf-P69-ibm69n07.xml",
];
