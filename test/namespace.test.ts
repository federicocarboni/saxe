import {expect} from "chai";
import type {
  NamespaceAttributes,
  NamespaceResolver,
  QName,
  SaxNamespaceHandler,
} from "../src/index.ts";
import {
  SaxNamespaceParser,
  XML_NAMESPACE,
  XMLNS_NAMESPACE,
} from "../src/index.ts";

type PlainQName = {
  name: string;
  localName: string;
  prefix?: string;
  namespace?: string;
};

interface Node {
  name: PlainQName;
  attributes: [PlainQName, string][];
  children: (Node | string)[];
}

function copyQName(name: QName) {
  const nameCopy: PlainQName = {
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
class TreeBuilder implements SaxNamespaceHandler {
  // lookupNamespace?(prefix: string | undefined): string | undefined {
  //   throw new Error("Method not implemented.");
  // }
  root: Node | undefined = undefined;
  private nodeStack_: Node[] = [];
  private pushNode_(
    name: QName,
    attributes: NamespaceAttributes,
  ) {
    const node: Node = {
      name: copyQName(name),
      attributes: Array.from(
        attributes,
        ([name, value]) => [copyQName(name), value],
      ),
      children: [] as Node[],
    };
    if (this.nodeStack_.length === 0) {
      this.root = node;
    } else {
      this.nodeStack_[this.nodeStack_.length - 1]!.children.push(node);
    }
    this.nodeStack_.push(node);
  }
  startTag(name: QName, attributes: NamespaceAttributes): void {
    this.pushNode_(name, attributes);
  }
  endTag(name: QName): void {
    void name;
    this.nodeStack_.pop();
  }
  text(text: string): void {
    if (text.trim()) {
      this.nodeStack_[this.nodeStack_.length - 1]!.children.push(text);
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
        children: [{
          name: {name: "empty", localName: "empty"},
          attributes: [[{name: "attr", localName: "attr"}, "value"]],
          children: [],
        }, {
          name: {name: "ns", localName: "ns", namespace: "urn:default"},
          attributes: [[{
            name: "xmlns",
            localName: "xmlns",
            namespace: "http://www.w3.org/2000/xmlns/",
          }, "urn:default"], [{
            name: "xmlns:a",
            localName: "a",
            prefix: "xmlns",
            namespace: "http://www.w3.org/2000/xmlns/",
          }, "urn:a"]],
          children: [{
            name: {name: "empty", localName: "empty", namespace: "urn:default"},
            attributes: [[{name: "attr", localName: "attr"}, "value"]],
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
            children: [],
          }, {
            name: {name: "ns", localName: "ns", namespace: "urn:default-other"},
            attributes: [[{
              name: "xmlns",
              localName: "xmlns",
              namespace: "http://www.w3.org/2000/xmlns/",
            }, "urn:default-other"], [{
              name: "xmlns:a",
              localName: "a",
              prefix: "xmlns",
              namespace: "http://www.w3.org/2000/xmlns/",
            }, "urn:a-other"]],
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
              children: [],
            }],
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
            children: [],
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
  it("not-wf: namespace not declared in attribute", function() {
    expect(() =>
      getTree('<root xmlns="urn:default"><empty a:attr="value" /></root>')
    )
      .throws().and.includes({
        name: "UndeclaredPrefix",
        attribute: "a:attr",
      });
  });
  it("not-wf: invalid tag QName", function() {
    expect(() => getTree("<root: />"))
      .throws().and.includes({
        name: "InvalidQName",
        element: "root:",
      });
    expect(() => getTree("<:root />"))
      .throws().and.includes({
        name: "InvalidQName",
        element: ":root",
      });
    expect(() => getTree("<a:root:b />"))
      .throws().and.includes({
        name: "InvalidQName",
        element: "a:root:b",
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
  it("not-wf: xmlns prefix as element tag", function() {
    expect(() => getTree("<root><xmlns:empty /></root>"))
      .throws().and.includes({
        name: "ReservedPrefix",
        element: "xmlns:empty",
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
  it("not-wf: XMLNS namespace is reserved", function() {
    expect(() =>
      getTree(
        '<root xmlns:x="http://www.w3.org/2000/xmlns/"><a:empty /></root>',
      )
    )
      .throws().and.includes({
        name: "ReservedNamespace",
        attribute: "xmlns:x",
      });
  });
  it("not-wf: XML namespace is reserved", function() {
    expect(() =>
      getTree(
        '<root xmlns:x="http://www.w3.org/XML/1998/namespace"><a:empty /></root>',
      )
    )
      .throws().and.includes({
        name: "ReservedNamespace",
        attribute: "xmlns:x",
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
      } satisfies Node,
    );
  });
  it("wf: doctype name matches QName", function() {
    expect(
      getTree(
        "<!DOCTYPE doc:doc [ <!ELEMENT doc:doc EMPTY> ]><doc/>",
      ),
    ).deep.equals({
      name: {localName: "doc", name: "doc"},
      attributes: [],
      children: [],
    });
  });
  it("wf: element name in DTD matches QName", function() {
    expect(
      getTree(
        "<!DOCTYPE doc [ <!ELEMENT doc:doc EMPTY> ]><doc/>",
      ),
    ).deep.equals({
      name: {localName: "doc", name: "doc"},
      attributes: [],
      children: [],
    });
  });
  it("not-wf: doctype name must match QName", function() {
    expect(() => getTree("<!DOCTYPE doc: []><doc/>"))
      .throws()
      .and.includes({
        name: "InvalidQName",
      });
  });
  it("not-wf: element name in DTD must match QName", function() {
    expect(() =>
      getTree(
        "<!DOCTYPE doc [ <!ELEMENT doc: EMPTY> ]><doc/>",
      )
    )
      .throws()
      .and.includes({
        name: "InvalidQName",
      });
  });
  it("not-wf: attribute name in DTD must match QName", function() {
    expect(() =>
      getTree(
        "<!DOCTYPE doc [ <!ATTLIST doc foo: #REQUIRED> ]><doc/>",
      )
    )
      .throws()
      .and.includes({
        name: "InvalidQName",
      });
  });
  it("not-wf: notation name must match NCName", function() {
    expect(() =>
      getTree(
        '<!DOCTYPE doc [ <!NOTATION ent: PUBLIC "ent"> ]><doc/>',
      )
    )
      .throws()
      .and.includes({
        name: "InvalidNcName",
      });
  });
  it("not-wf: entity name must match NCName", function() {
    expect(() =>
      getTree(
        '<!DOCTYPE doc [ <!ENTITY ent: "ent"> ]><doc/>',
      )
    )
      .throws()
      .and.includes({
        name: "InvalidNcName",
      });
  });
  it("not-wf: PI target must match NCName", function() {
    expect(() =>
      getTree(
        "<?foo: x?><doc/>",
      )
    )
      .throws()
      .and.includes({
        name: "InvalidNcName",
      });
  });
});

class Handler implements SaxNamespaceHandler {
  private depth_ = 0;
  constructor(
    private callback_: (
      resolver: NamespaceResolver,
      depth: number,
      name: QName,
      attributes: NamespaceAttributes,
    ) => void,
  ) {
  }
  startTag(
    name: QName,
    attributes: NamespaceAttributes,
    resolver: NamespaceResolver,
  ): void {
    this.callback_(resolver, this.depth_, name, attributes);
    this.depth_ += 1;
  }
  endTag(name: QName, resolver: NamespaceResolver): void {
    // this.callback_(this.depth_, resolver, name);
    void name;
    void resolver;
  }
  text(text: string): void {
    void text;
  }
}

function readAttributes(
  callback: (attributes: NamespaceAttributes) => void,
  input: string,
) {
  new SaxNamespaceParser(
    new Handler((_resolver, _depth, _name, attributes) => {
      callback(attributes);
    }),
  ).parse(input);
}

describe("NamespaceAttributes", function() {
  describe("get()", function() {
    it("returns a plain attribute", function() {
      readAttributes((attributes) => {
        expect(attributes.has("foo")).equals(true);
        expect(attributes.get("foo")).equals("bar");
        expect(attributes.has("foo", "urn:x")).equals(false);
        expect(attributes.get("foo", "urn:x")).equals(undefined);
      }, '<doc foo="bar"></doc>');
    });
    it("returns a namespaced attribute", function() {
      readAttributes((attributes) => {
        expect(attributes.has("foo")).equals(false);
        expect(attributes.get("foo")).equals(undefined);
        expect(attributes.has("foo", "urn:x")).equals(true);
        expect(attributes.get("foo", "urn:x")).equals("bar");
      }, '<doc xmlns:x="urn:x" x:foo="bar"></doc>');
    });
    it("returns undefined for qualified names", function() {
      readAttributes((attributes) => {
        expect(attributes.has("x:foo")).equals(false);
        expect(attributes.get("x:foo")).equals(undefined);
        expect(attributes.has("x:foo", "urn:x")).equals(false);
        expect(attributes.get("x:foo", "urn:x")).equals(undefined);
      }, '<doc xmlns:x="urn:x" x:foo="bar"></doc>');
    });
    it("returns undefined for unknown attributes", function() {
      readAttributes((attributes) => {
        expect(attributes.has("foo")).equals(false);
        expect(attributes.get("foo")).equals(undefined);
        expect(attributes.has("foo", "urn:foo")).equals(false);
        expect(attributes.get("foo", "urn:foo")).equals(undefined);
      }, "<doc></doc>");
    });
  });
  const ITER_INPUT =
    '<doc xmlns="urn:y" xmlns:x="urn:x" x:foo="bar" baz="boo"></doc>';
  const ITER_RESULT = [
    [
      {
        localName: "xmlns",
        name: "xmlns",
        namespace: "http://www.w3.org/2000/xmlns/",
        prefix: undefined,
      },
      "urn:y",
    ],
    [
      {
        localName: "x",
        name: "xmlns:x",
        namespace: "http://www.w3.org/2000/xmlns/",
        prefix: "xmlns",
      },
      "urn:x",
    ],
    [
      {localName: "foo", name: "x:foo", namespace: "urn:x", prefix: "x"},
      "bar",
    ],
    [
      {localName: "baz", name: "baz", namespace: undefined, prefix: undefined},
      "boo",
    ],
  ];
  const ITER_VALUES = ITER_RESULT.map(([, value]) => value);
  const ITER_KEYS = ITER_RESULT.map(([name]) => name);
  it("size", function() {
    readAttributes((attributes) => {
      expect(attributes.size).equals(ITER_RESULT.length);
    }, ITER_INPUT);
  });
  it("forEach()", function() {
    readAttributes((attributes) => {
      const attrs: [QName, string][] = [];
      const thisArg = {};
      attributes.forEach(function(this: unknown, value, name, attributes2) {
        expect(this).equals(thisArg);
        expect(attributes2).equals(attributes);
        attrs.push([name, value]);
      }, thisArg);
      expect([...attributes]).deep.equals(ITER_RESULT);
    }, ITER_INPUT);
  });
  it("keys()", function() {
    readAttributes((attributes) => {
      expect([...attributes.keys()]).deep.equals(ITER_KEYS);
    }, ITER_INPUT);
  });
  it("values()", function() {
    readAttributes((attributes) => {
      expect([...attributes.values()]).deep.equals(ITER_VALUES);
    }, ITER_INPUT);
  });
  it("[iterator]()", function() {
    readAttributes((attributes) => {
      expect([...attributes]).deep.equals(ITER_RESULT);
    }, ITER_INPUT);
  });
});

function readResolver(
  callback: (resolver: NamespaceResolver, depth: number) => void,
  input: string,
) {
  new SaxNamespaceParser(
    new Handler((resolver, depth, _name, _attributes) => {
      callback(resolver, depth);
    }),
  ).parse(input);
}

describe("NamespaceResolver", function() {
  it("lookupNamespace does not accept the empty string", function() {
    readResolver((resolver) => {
      expect(resolver.lookupNamespace("")).equals(undefined);
      expect(resolver.lookupNamespace()).equals("urn:a");
    }, `<doc xmlns="urn:a"></doc>`);
  });
  it("lookupNamespace returns the XML namespace for prefix 'xml'", function() {
    readResolver((resolver) => {
      expect(resolver.lookupNamespace("xml")).equals(XML_NAMESPACE);
    }, `<doc></doc>`);
  });
  it("lookupNamespace returns the XMLNS namespace for prefix 'xmlns'", function() {
    readResolver((resolver) => {
      expect(resolver.lookupNamespace("xmlns")).equals(XMLNS_NAMESPACE);
    }, `<doc></doc>`);
  });
  it("lookupNamespace returns the latest bound namespace", function() {
    readResolver(
      (resolver, depth) => {
        if (depth === 1) {
          expect(resolver.lookupNamespace("foo")).equals("urn:b");
          expect(resolver.lookupNamespace("bar")).equals("urn:c");
          expect(resolver.lookupNamespace()).equals("urn:d");
        }
      },
      `<doc xmlns:foo="urn:a" xmlns="urn:d" xmlns:bar="urn:c"><foo:empty xmlns:foo="urn:b" /></doc>`,
    );
  });
  it("lookupNamespace returns undefined for undeclared prefixes", function() {
    readResolver((resolver) => {
      expect(resolver.lookupNamespace("foo")).equals(undefined);
      expect(resolver.lookupNamespace()).equals(undefined);
    }, `<doc></doc>`);
  });
  it("lookupPrefix does not accept the empty string", function() {
    readResolver((resolver) => {
      expect(resolver.lookupPrefix("")).equals(undefined);
    }, `<doc xmlns="urn:a"></doc>`);
  });
  it("lookupPrefix returns 'xml' for the XML namespace", function() {
    readResolver((resolver) => {
      expect(resolver.lookupPrefix(XML_NAMESPACE)).equals("xml");
    }, `<doc></doc>`);
  });
  it("lookupPrefix returns 'xmlns' for the XMLNS namespace", function() {
    readResolver((resolver) => {
      expect(resolver.lookupPrefix(XMLNS_NAMESPACE)).equals("xmlns");
    }, `<doc></doc>`);
  });
  it("lookupPrefix returns the latest bound prefix", function() {
    readResolver((resolver, depth) => {
      if (depth === 1) {
        expect(resolver.lookupPrefix("urn:a")).equals("foo");
      }
    }, `<doc xmlns:foo="urn:a"><foo:empty xmlns:foo="urn:b" /></doc>`);
  });
  it("lookupPrefix returns element names first", function() {
    readResolver((resolver, depth) => {
      if (depth === 1) {
        expect(resolver.lookupPrefix("urn:a")).equals("foo");
      }
    }, `<doc><foo:empty xmlns:bar="urn:a" xmlns:foo="urn:a" /></doc>`);
  });
  it("lookupPrefix returns undefined for undeclared namespaces", function() {
    readResolver((resolver) => {
      expect(resolver.lookupPrefix("urn:a")).equals(undefined);
    }, `<doc></doc>`);
  });
});
