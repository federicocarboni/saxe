import {expect} from "chai";
import {Attributes, SaxParser, SaxReader} from "../src/index.ts";
import {CanonicalXmlWriter} from "./canonical_xml.ts";

class CanonicalEntityReader implements SaxReader {
  public entity: string | undefined;
  public canonical: CanonicalXmlWriter;
  constructor() {
    this.canonical = new CanonicalXmlWriter();
  }
  entityRef(entity: string): boolean {
    this.entity = entity;
    return true;
  }
  startTag(name: string, attributes: Attributes): void {
    this.canonical.startTag(name, attributes);
  }
  emptyTag(name: string, attributes: Attributes): void {
    this.canonical.emptyTag(name, attributes);
  }
  endTag(name: string): void {
    this.canonical.endTag(name);
  }
  text(content: string): void {
    this.canonical.text(content);
  }
}

function getEntity(entities: Record<string, string>, ...chunks: string[]) {
  const reader = new CanonicalEntityReader();
  const parser = new SaxParser(reader, {
    entityProvider: {
      getEntity(entity: string): string | undefined {
        return entities.hasOwnProperty(entity)
          ? entities[entity]
          : undefined;
      },
    },
  });
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
  it("wf: declared general entity reference in content", function() {
    expect(
      getEntity(
        {},
        "<!DOCTYPE root [<!ENTITY entity '<element attribute=&#34;value&#34;></element>'>]><root>&entity;</root>",
      ).output,
    ).equals('<root><element attribute="value"></element></root>');
  });
  it("wf: general entity reference in attribute value", function() {
    expect(
      getEntity({
        entity: "entity value",
      }, '<root value="&entity;"></root>').output,
    ).equals('<root value="entity value"></root>');
  });
  it("not-wf: undeclared general entity reference in attribute value", function() {
    expect(() => getEntity({}, '<root value="&entity;"></root>'))
      .to.throw().and.have.property("name", "UndeclaredEntity");
  });
  it("not-wf: general entity reference starting with invalid character", function() {
    expect(() => getEntity({}, '<root value="&.entity;"></root>'))
      .to.throw().and.have.property("name", "InvalidEntityRef");
  });
});
