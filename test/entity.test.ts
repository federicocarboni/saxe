import {expect} from "chai";
import {SaxParser, SaxReader} from "../src/index.ts";
import {CanonicalXmlWriter} from "./canonical_xml.ts";

class CanonicalEntityReader implements SaxReader {
  public entity: string | undefined;
  public canonical: CanonicalXmlWriter;
  constructor(private entities: Record<string, string>) {
    this.canonical = new CanonicalXmlWriter();
  }
  replaceEntityRef(entity: string): string | undefined {
    return this.entities.hasOwnProperty(entity)
      ? this.entities[entity]
      : undefined;
  }
  entityRef(entity: string): void {
    this.entity = entity;
  }
  start(name: string, attributes: ReadonlyMap<string, string>): void {
    this.canonical.start(name, attributes);
  }
  empty(name: string, attributes: ReadonlyMap<string, string>): void {
    this.canonical.empty(name, attributes);
  }
  end(name: string): void {
    this.canonical.end(name);
  }
  text(text: string): void {
    this.canonical.text(text);
  }
}

function getEntity(entities: Record<string, string>, ...chunks: string[]) {
  const reader = new CanonicalEntityReader(entities);
  const parser = new SaxParser(reader);
  for (const chunk of chunks) {
    parser.write(chunk);
  }
  parser.end();
  return {entity: reader.entity, output: reader.canonical.output};
}

describe("general entity reference", function() {
  it("wf: general entity reference in content", function() {
    expect(getEntity({}, "<root>&entity;</root>").entity).equals("entity");
  });
  it("wf: general entity reference in attribute value", function() {
    expect(
      getEntity({
        entity: "entity value",
      }, '<root value="&entity;"></root>').output,
    ).equals('<root value="entity value"></root>');
  });
  it("not-wf: general entity reference in attribute value is unresolved", function() {
    expect(() => getEntity({}, '<root value="&entity;"></root>'))
      .to.throw().and.have.property("code", "UNRESOLVED_ENTITY");
  });
  it("not-wf: general entity reference starting with invalid character", function() {
    expect(() => getEntity({}, '<root value="&.entity;"></root>'))
      .to.throw().and.have.property("code", "INVALID_ENTITY_REF");
  });
});
