import {expect} from "chai";
import {toCanonicalOpt} from "./template.ts";

function toCanonicalWithEntities(
  entities: Record<string, string>,
  ...chunks: string[]
) {
  return toCanonicalOpt(chunks, {
    entityProvider: {
      getEntity(entity: string): string | undefined {
        return Object.hasOwn(entities, entity)
          ? entities[entity]
          : undefined;
      },
    },
  });
}

describe("general entity reference", function() {
  it("wf: general entity reference in content", function() {
    expect(toCanonicalWithEntities({entity: "entity"}, "<root>&entity;</root>"))
      .equals("<root>entity</root>");
  });
  it("wf: declared general entity reference in content", function() {
    expect(
      toCanonicalWithEntities(
        {},
        "<!DOCTYPE root [<!ENTITY entity '<element attribute=&#34;value&#34;></element>'>]><root>&entity;</root>",
      ),
    ).equals('<root><element attribute="value"></element></root>');
  });
  it("wf: general entity reference in attribute value", function() {
    expect(
      toCanonicalWithEntities({
        entity: "entity value",
      }, '<root value="&entity;"></root>'),
    ).equals('<root value="entity value"></root>');
  });
  it("not-wf: undeclared general entity reference in attribute value", function() {
    expect(() => toCanonicalWithEntities({}, '<root value="&entity;"></root>'))
      .to.throw().and.have.property("name", "UndeclaredEntity");
  });
  it("not-wf: general entity reference starting with invalid character", function() {
    expect(() => toCanonicalWithEntities({}, '<root value="&.entity;"></root>'))
      .to.throw().and.have.property("name", "InvalidEntityRef");
  });
});
