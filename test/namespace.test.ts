import {expect} from "chai";
import {AttributesNs, QName, SaxParserNs, SaxReaderNs} from "../src/index.ts";

interface Node {
  name: QName;
  attributes: [QName, string][];
  empty: boolean;
  children: (Node | string)[];
}

function copyQName(name: QName): QName {
  const nameCopy: QName = {
    name: name.name,
    localName: name.localName,
  };
  if (name.prefix != null) {
    nameCopy.prefix = name.prefix;
  }
  if (name.uri != null) {
    nameCopy.uri = name.uri;
  }
  return nameCopy;
}

// Builds a very basic DOM from an XML document
class TreeBuilder implements SaxReaderNs {
  // lookupNamespace?(prefix: string | undefined): string | undefined {
  //   throw new Error("Method not implemented.");
  // }
  root: Node | undefined = undefined;
  private nodeStack_: Node[] = [];
  private pushNode_(name: QName, attributes: AttributesNs, empty: boolean) {
    const node: Node = {
      name: copyQName(name),
      attributes: Array.from(
        attributes,
        ([name, value]) => [copyQName(name), value],
      ),
      empty,
      children: [] as Node[],
    };
    if (this.nodeStack_.length === 0) {
      this.root = node;
    } else {
      this.nodeStack_[this.nodeStack_.length - 1].children.push(node);
    }
    this.nodeStack_.push(node);
  }
  start(name: QName, attributes: AttributesNs): void {
    this.pushNode_(name, attributes, false);
  }
  empty(name: QName, attributes: AttributesNs): void {
    this.pushNode_(name, attributes, true);
  }
  end(name: QName): void {
    void name;
    this.nodeStack_.pop();
  }
  text(text: string): void {
    if (text.trim()) {
      this.nodeStack_[this.nodeStack_.length - 1].children.push(text);
    }
  }
}

function getTree(input: string): Node | undefined {
  const treeBuilder = new TreeBuilder();
  const parser = new SaxParserNs(treeBuilder);
  parser.write(input);
  parser.end();
  return treeBuilder.root;
}

describe("namespace", function() {
  it("wf: basic namespace test", function() {
    expect(getTree(`<root>
  <empty attr="value" />
  <ns xmlns="urn:default" xmlns:a="urn:a">
    <empty attr="value" />
    <a:empty a:attr="value" />
    <ns xmlns="urn:default-other" xmlns:a="urn:a-other">
      <a:empty a:attr="value" />
    </ns>
    <a:empty a:attr="value" />
  </ns>
</root>`)).deep.equals(
      {
        name: {name: "root", localName: "root"},
        attributes: [],
        empty: false,
        children: [{
          name: {name: "empty", localName: "empty"},
          attributes: [[{name: "attr", localName: "attr"}, "value"]],
          empty: true,
          children: [{
            name: {name: "ns", localName: "ns", uri: "urn:default"},
            attributes: [[{name: "xmlns", localName: "xmlns"}, "urn:default"], [
              {
                name: "xmlns:a",
                localName: "a",
                prefix: "xmlns",
                uri: "http://www.w3.org/2000/xmlns/",
              },
              "urn:a",
            ]],
            empty: false,
            children: [{
              name: {name: "empty", localName: "empty", uri: "urn:default"},
              attributes: [[{name: "attr", localName: "attr"}, "value"]],
              empty: true,
              children: [{
                name: {
                  name: "a:empty",
                  localName: "empty",
                  prefix: "a",
                  uri: "urn:a",
                },
                attributes: [[{
                  name: "a:attr",
                  localName: "attr",
                  prefix: "a",
                  uri: "urn:a",
                }, "value"]],
                empty: true,
                children: [{
                  name: {name: "ns", localName: "ns", uri: "urn:default-other"},
                  attributes: [[
                    {name: "xmlns", localName: "xmlns"},
                    "urn:default-other",
                  ], [{
                    name: "xmlns:a",
                    localName: "a",
                    prefix: "xmlns",
                    uri: "http://www.w3.org/2000/xmlns/",
                  }, "urn:a-other"]],
                  empty: false,
                  children: [{
                    name: {
                      name: "a:empty",
                      localName: "empty",
                      prefix: "a",
                      uri: "urn:a-other",
                    },
                    attributes: [[{
                      name: "a:attr",
                      localName: "attr",
                      prefix: "a",
                      uri: "urn:a-other",
                    }, "value"]],
                    empty: true,
                    children: [],
                  }, {
                    name: {
                      name: "a:empty",
                      localName: "empty",
                      prefix: "a",
                      uri: "urn:a",
                    },
                    attributes: [[{
                      name: "a:attr",
                      localName: "attr",
                      prefix: "a",
                      uri: "urn:a",
                    }, "value"]],
                    empty: true,
                    children: [],
                  }],
                }],
              }],
            }],
          }],
        }],
      } satisfies Node,
    );
  });
  it("not-wf: namespace not declared", function() {
    expect(() => getTree('<root xmlns="urn:default"><a:empty /></root>'))
      .throws().and.includes({
        code: "UNDECLARED_PREFIX",
        element: "a:empty",
      });
  });
  it("not-wf: invalid prefix", function() {
    expect(() => getTree('<root xmlns:a:="urn:default"><a:empty /></root>'))
      .throws().and.includes({
        code: "INVALID_QNAME",
        attribute: "xmlns:a:",
      });
  });
  it("not-wf: empty namespace URI", function() {
    expect(() => getTree('<root xmlns:a=""><a:empty /></root>'))
      .throws().and.includes({
        code: "PREFIX_UNDECLARING",
        attribute: "xmlns:a",
      });
  });
  it("not-wf: xmlns reserved prefix", function() {
    expect(() => getTree('<root xmlns:xmlns=""><a:empty /></root>'))
      .throws().and.includes({
        code: "RESERVED_PREFIX",
        attribute: "xmlns:xmlns",
      });
  });
  it("not-wf: xml reserved prefix", function() {
    expect(() => getTree('<root xmlns:xml="urn:default"><a:empty /></root>'))
      .throws().and.includes({
        code: "RESERVED_PREFIX",
        attribute: "xmlns:xml",
      });
  });
  it("wf: xml prefix declaration", function() {
    expect(
      getTree(
        '<root xmlns:xml="http://www.w3.org/XML/1998/namespace"></root>',
      ),
    ).deep.equals(
      {
        name: {localName: "root", name: "root"},
        attributes: [[{
          localName: "xml",
          name: "xmlns:xml",
          prefix: "xmlns",
          uri: "http://www.w3.org/2000/xmlns/",
        }, "http://www.w3.org/XML/1998/namespace"]],
        children: [],
        empty: false,
      } satisfies Node,
    );
  });
  it("wf: xmlns prefix in element name", function() {
    expect(() =>
      getTree(
        '<root xmlns="urn:default"><xmlns:empty /></root>',
      )
    )
      .throws()
      .and.includes({
        code: "RESERVED_PREFIX",
        element: "xmlns:empty",
      });
  });
});
