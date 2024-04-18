import {expect} from "chai";
import {Doctype, SaxReader, SaxParser} from "../src/index.ts";

class DoctypeDeclReader implements SaxReader {
  public doctypeDecl: Doctype | undefined;
  xml(): void {
    throw new Error("Method not implemented.");
  }
  doctype(doctype: Doctype): void {
    this.doctypeDecl = doctype;
  }
  pi(): void {
    throw new Error("Method not implemented.");
  }
  comment(): void {
    throw new Error("Method not implemented.");
  }
  replaceEntityRef(): string | undefined {
    throw new Error("Method not implemented.");
  }
  entityRef(): void {
    throw new Error("Method not implemented.");
  }
  start(): void {
    throw new Error("Method not implemented.");
  }
  empty(): void {
    throw new Error("Method not implemented.");
  }
  end(): void {
    throw new Error("Method not implemented.");
  }
  text(): void {
    throw new Error("Method not implemented.");
  }
}

function getDoctypeDecl(input: string | string[]) {
  const docReader = new DoctypeDeclReader();
  const parser = new SaxParser(docReader);
  const inputs = typeof input === "string" ? [input] : input;
  for (const inp of inputs) {
    parser.write(inp);
  }
  return docReader.doctypeDecl;
}

describe("doctypedecl", function() {
  it("wf: doctypedecl without ExternalID or intSubset", function() {
    expect(getDoctypeDecl("<!DOCTYPE doctypeName >"))
      .to.have.property("name", "doctypeName");
  });
  it("wf: doctypedecl with ExternalID and no intSubset", function() {
    expect(
      getDoctypeDecl('<!DOCTYPE doctypeName SYSTEM "-//DTD/something" >'),
    )
      .to.have.property("name", "doctypeName");
  });
  it("wf: doctypedecl with intSubset and no ExternalID", function() {
    expect(getDoctypeDecl(
      "<!DOCTYPE doctypeName [ <![IGNORE[  ]]> ] >",
    ))
      .to.have.property("name", "doctypeName");
  });
  it("wf: doctype with intSubset and ExternalID", function() {
    expect(
      getDoctypeDecl(
        '<!DOCTYPE doctypeName PUBLIC "/public/dtd" "-//DTD/something" [ <![IGNORE[  ]]> ] >',
      ),
    ).to.have.property("name", "doctypeName");
  });
});
