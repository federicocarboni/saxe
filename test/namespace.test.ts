import {expect} from "chai";
import {
  Doctype,
  NamespaceAttributes,
  NamespaceResolver,
  QName,
  SaxNamespaceParser,
  SaxNamespaceReader,
  XmlDeclaration,
} from "../src/index.ts";

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
  if (name.namespace != null) {
    nameCopy.namespace = name.namespace;
  }
  return nameCopy;
}

// Builds a very basic DOM from an XML document
class TreeBuilder implements SaxNamespaceReader {
  // lookupNamespace?(prefix: string | undefined): string | undefined {
  //   throw new Error("Method not implemented.");
  // }
  root: Node | undefined = undefined;
  private nodeStack_: Node[] = [];
  private pushNode_(
    name: QName,
    attributes: NamespaceAttributes,
    empty: boolean,
  ) {
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
  startTag(name: QName, attributes: NamespaceAttributes): void {
    this.pushNode_(name, attributes, false);
  }
  emptyTag(name: QName, attributes: NamespaceAttributes): void {
    this.pushNode_(name, attributes, true);
  }
  endTag(name: QName): void {
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
  const parser = new SaxNamespaceParser(treeBuilder);
  parser.parse(input);
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
            name: {name: "ns", localName: "ns", namespace: "urn:default"},
            attributes: [[{
              name: "xmlns",
              localName: "xmlns",
              namespace: "http://www.w3.org/2000/xmlns/",
            }, "urn:default"], [
              {
                name: "xmlns:a",
                localName: "a",
                prefix: "xmlns",
                namespace: "http://www.w3.org/2000/xmlns/",
              },
              "urn:a",
            ]],
            empty: false,
            children: [{
              name: {
                name: "empty",
                localName: "empty",
                namespace: "urn:default",
              },
              attributes: [[{name: "attr", localName: "attr"}, "value"]],
              empty: true,
              children: [{
                name: {
                  name: "a:empty",
                  localName: "empty",
                  prefix: "a",
                  namespace: "urn:a",
                },
                attributes: [[{
                  name: "a:attr",
                  localName: "attr",
                  prefix: "a",
                  namespace: "urn:a",
                }, "value"]],
                empty: true,
                children: [{
                  name: {
                    name: "ns",
                    localName: "ns",
                    namespace: "urn:default-other",
                  },
                  attributes: [[
                    {
                      name: "xmlns",
                      localName: "xmlns",
                      namespace: "http://www.w3.org/2000/xmlns/",
                    },
                    "urn:default-other",
                  ], [{
                    name: "xmlns:a",
                    localName: "a",
                    prefix: "xmlns",
                    namespace: "http://www.w3.org/2000/xmlns/",
                  }, "urn:a-other"]],
                  empty: false,
                  children: [{
                    name: {
                      name: "a:empty",
                      localName: "empty",
                      prefix: "a",
                      namespace: "urn:a-other",
                    },
                    attributes: [[{
                      name: "a:attr",
                      localName: "attr",
                      prefix: "a",
                      namespace: "urn:a-other",
                    }, "value"]],
                    empty: true,
                    children: [],
                  }, {
                    name: {
                      name: "a:empty",
                      localName: "empty",
                      prefix: "a",
                      namespace: "urn:a",
                    },
                    attributes: [[{
                      name: "a:attr",
                      localName: "attr",
                      prefix: "a",
                      namespace: "urn:a",
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
        name: "UndeclaredPrefix",
        element: "a:empty",
      });
  });
  it("not-wf: invalid prefix", function() {
    expect(() => getTree('<root xmlns:a:="urn:default"><a:empty /></root>'))
      .throws().and.includes({
        name: "InvalidQName",
        attribute: "xmlns:a:",
      });
  });
  it("not-wf: empty namespace namespace", function() {
    expect(() => getTree('<root xmlns:a=""><a:empty /></root>'))
      .throws().and.includes({
        name: "PrefixUndeclaring",
        attribute: "xmlns:a",
      });
  });
  it("not-wf: xmlns reserved prefix", function() {
    expect(() => getTree('<root xmlns:xmlns=""><a:empty /></root>'))
      .throws().and.includes({
        name: "ReservedPrefix",
        attribute: "xmlns:xmlns",
      });
  });
  it("not-wf: xml reserved prefix", function() {
    expect(() => getTree('<root xmlns:xml="urn:default"><a:empty /></root>'))
      .throws().and.includes({
        name: "ReservedPrefix",
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
          namespace: "http://www.w3.org/2000/xmlns/",
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
        name: "ReservedPrefix",
        element: "xmlns:empty",
      });
  });
});

// class Reader implements SaxNamespaceReader {
//   private depth_ = 0;
//   constructor(
//     private callback_: (
//       depth: number,
//       resolver: NamespaceResolver,
//       name: QName,
//     ) => void,
//   ) {
//   }
//   startTag(
//     name: QName,
//     attributes: NamespaceAttributes,
//     resolver: NamespaceResolver,
//   ): void {
//     console.log(attributes, resolver);

//     this.callback_(this.depth_, resolver, name);
//     void attributes;
//     this.depth_ += 1;
//   }
//   emptyTag(
//     name: QName,
//     attributes: NamespaceAttributes,
//     resolver: NamespaceResolver,
//   ): void {
//     this.startTag(name, attributes, resolver);
//     this.endTag(name, resolver);
//   }
//   endTag(name: QName, resolver: NamespaceResolver): void {
//     // this.callback_(this.depth_, resolver, name);
//     void name;
//     void resolver;
//   }
//   text(text: string): void {
//     void text;
//   }
// }

// describe("NamespaceResolver", function() {
//   it("works", function() {
//     const reader = new Reader((depth, resolver) => {
//       if (depth === 1) {
//         expect(resolver.lookupPrefix("urn:a")).equals("foo");
//         console.log(resolver.lookupNamespace("foo"));
//         console.log(resolver.lookupNamespace("xml"));
//         console.log(resolver.lookupNamespace("xmlns"));
//         console.log(resolver.lookupPrefix("urn:a"));
//         console.log(resolver.lookupPrefix("urn:b"));
//       } else {
//         console.log(resolver.lookupNamespace("foo"));
//         console.log(resolver.lookupNamespace("xml"));
//         console.log(resolver.lookupNamespace("xmlns"));
//         console.log(resolver.lookupPrefix("urn:a"));
//         console.log(resolver.lookupPrefix("urn:b"));
//       }
//     });
//     const parser = new SaxNamespaceParser(reader);
//     parser.write(`<doc xmlns:foo="urn:a"><foo:empty xmlns:bar="urn:a" /></doc>`);
//     parser.end();
//   });
// });
