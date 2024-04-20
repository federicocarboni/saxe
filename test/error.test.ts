import {expect} from "chai";
import {createSaxError} from "../src/error.ts";
import {isSaxError} from "../src/index.ts";

describe("SaxError", function() {
  it("isSaxError returns true for SaxErrors", function() {
    expect(isSaxError(createSaxError("UNEXPECTED_EOF"))).to.be.true;
  });
  it("isSaxError returns false for non SaxErrors", function() {
    expect(isSaxError(new Error("something else"))).to.be.false;
  });
});
