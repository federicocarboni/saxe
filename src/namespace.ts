import {isNameStartChar} from "./chars.ts";
import {SaxError} from "./error.ts";
import type {
  Attributes,
  Doctype,
  SaxOptions,
  SaxPrologReader,
  SaxReader,
  XmlDeclaration,
} from "./parser.ts";
import {Flags, SaxParser} from "./parser.ts";

/** A qualified XML name for elements or attributes. */
export interface QName {
  /** Qualified name of the element or attribute. */
  name: string;
  /** Local part of the name. */
  localName: string;
  /** Prefix part of the name, if any. */
  prefix?: string | undefined;
  /** Namespace URI, if any. */
  namespace?: string | undefined;
}

/**
 * An immutable namespace-aware collection of the attributes of an XML tag.
 *
 * @see {@linkcode Attributes}
 */
export interface NamespaceAttributes {
  /** The number of attributes. */
  readonly size: number;
  /**
   * Returns the value of the attribute from its local name and namespace.
   *
   * ```js
   * // ✘ Qualified name is not supported
   * attributes.get("xml:lang")
   * // ✔ Namespaced attribute
   * attributes.get("lang", XML_NAMESPACE)
   * // ✔ No namespace
   * attributes.get("href")
   * ```
   * @param name - Local name of the attribute. Qualified names are not
   * supported.
   * @param namespace - Namespace URI for attributes with a namespace.
   * @returns - Returns the value of the attribute with the specified name and
   * namespace. If there is no attribute with the specified name and namespace
   * `undefined` is returned.
   */
  get(name: string, namespace?: string | undefined): string | undefined;
  /**
   * Returns `true` if the specified attribute is present, `false` otherwise.
   * @param name - Local name of the attribute.
   * @param namespace - Namespace URI for attributes with a namespace.
   * @returns - Returns a boolean value indicating whether an attribute with the
   * specified name and namespace is present.
   */
  has(name: string, namespace?: string | undefined): boolean;
  /**
   * Executes `callbackfn` for each attribute.
   * @param callbackfn -
   * @param thisArg -
   */
  forEach(
    callbackfn: (
      value: string,
      name: QName,
      attributes: NamespaceAttributes,
    ) => void,
    thisArg?: unknown,
  ): void;
  /** @returns - Returns an iterator over the names of the attributes. */
  keys(): IterableIterator<QName>;
  /** @returns - Returns an iterator over the values of the attributes. */
  values(): IterableIterator<string>;
  /**
   * @returns - Returns an iterator over the names and values of the attributes.
   */
  entries(): IterableIterator<[QName, string]>;
  [Symbol.iterator](): IterableIterator<[QName, string]>;
}

/**
 * Resolves namespace URIs and prefixes from the current element of an XML
 * document.
 */
export interface NamespaceResolver {
  /**
   * Returns the namespace URI associated with the specified prefix.
   *
   * - If `prefix` is `"xml"` the return value is always the XML namespace.
   * - If `prefix` is `"xmlns"` the return value is always the XMLNS namespace.
   * - If `prefix` is `undefined` the return value is the default namespace URI.
   *
   * This function acts as if [DOM Node `lookupNamespaceURI`] were called on the
   * current element being parsed, usually the element of the last call to
   * {@linkcode SaxNamespaceReader.startTag}.
   *
   * [DOM Node `lookupNamespaceURI`]:
   * https://dom.spec.whatwg.org/#dom-node-lookupnamespaceuri
   * @param prefix - Prefix to look for. Can be set to `undefined` to lookup the
   * default namespace.
   * @returns - Returns the namespace URI associated with the specified prefix.
   * Returns `undefined` if the prefix is not found.
   */
  lookupNamespace(prefix?: string | undefined): string | undefined;
  /**
   * Returns the prefix for the given namespace URI. When multiple prefixes are
   * possible, this function searches the current element, then its attributes,
   * and proceeds recursively on its ancestors; the first match is returned. If
   * no match is found it returns `undefined`.
   *
   * Note that the return value is the most recent prefix bound to the specified
   * namespace, but if the prefix is shadowed by a later declaration it may not
   * be *currently* associated to the specified namespace.
   *
   * - If `namespace` is the XML namespace the return value is always `"xml"`.
   * - If `namespace` is the XMLNS namespace the return value is always
   *   `"xmlns"`.
   * - If `namespace` is empty the return value is always `undefined`.
   *
   * This function acts as if [DOM Node `lookupPrefix`] were called on the
   * current element being parsed, usually the element of the last call to
   * {@linkcode SaxNamespaceReader.startTag}.
   *
   * [DOM Node `lookupPrefix`]:
   * https://dom.spec.whatwg.org/#dom-node-lookupprefix
   * @param namespace - Namespace URI to look for.
   * @returns - Returns the prefix for the given namespace URI, if present, or
   * returns `undefined` if it is not.
   */
  lookupPrefix(namespace: string): string | undefined;
}

export interface SaxNamespaceReader extends SaxPrologReader {
  /**
   * Start tag.
   *
   * ```xml
   * <element attr="value">
   * ```
   * @param name - Name of the element.
   * @param attributes - Attributes of the tag.
   * @param resolver - Namespace resolver relative to the current element,
   * should not be used outside the handler.
   */
  startTag(
    name: QName,
    attributes: NamespaceAttributes,
    resolver: NamespaceResolver,
  ): void;
  /**
   * An end tag.
   *
   * ```xml
   * </element>
   * ```
   * @param name - Name of the element.
   * @param resolver - Namespace resolver relative to the current element,
   * should not be used outside the handler.
   */
  endTag(name: QName, resolver: NamespaceResolver): void;
  /**
   * A general entity reference.
   *
   * ```xml
   * <root>
   *   &entity;
   * </root>
   * ```
   *
   * This handler is equivalent to {@linkcode SaxReader.entityRef} except it
   * has access to the namespace resolver of the current element.
   * @param name - Name of the entity.
   * @param resolver - Namespace resolver relative to the current element,
   * should not be used outside the handler.
   * @returns - Returns `true` if entity `name` was recognized. If the function
   * is not defined or returns `false` the parser throws an `UndeclaredEntity`
   * error.
   */
  entityRef?(name: string, resolver: NamespaceResolver): boolean;
  /**
   * Text content.
   *
   * ```xml
   * <element>
   *   content
   * </element>
   * ```
   *
   * This handler is equivalent to {@linkcode SaxReader.text} except it has
   * access to the namespace resolver of the current element.
   * {@linkcode entityRef}.
   * @param content - Text content.
   * @param isCDataSection - Boolean value `true` if content originated from a
   * CDATA section or `false` if it is regular text.
   * @param resolver - Namespace resolver relative to the current element,
   * should not be used outside the handler.
   */
  text(
    content: string,
    isCDataSection: boolean,
    resolver: NamespaceResolver,
  ): void;
}

/** @internal */
interface AttributeNs extends QName {
  value: string;
}

/** @internal */
function getQName(attribute: AttributeNs): QName {
  return {
    name: attribute.name,
    localName: attribute.localName,
    prefix: attribute.prefix,
    namespace: attribute.namespace,
  };
}

/** @internal */
class NamespaceAttributes_ implements NamespaceAttributes {
  /** @internal */
  private map_ = new Map<string, AttributeNs>();
  /** @internal */
  add_(attribute: AttributeNs) {
    const key = attribute.namespace !== undefined
      ? `${attribute.namespace}:${attribute.localName}`
      : attribute.localName;
    this.map_.set(key, attribute);
  }
  /** @internal */
  iter_() {
    return this.map_.values();
  }
  get size() {
    return this.map_.size;
  }
  get(name: string, namespace?: string | undefined): string | undefined {
    // Name must be an NCName
    if (name.indexOf(":") !== -1) {
      return undefined;
    }
    const key = namespace != null ? `${namespace}:${name}` : name;
    const attribute = this.map_.get(key);
    return attribute !== undefined ? attribute.value : undefined;
  }
  has(name: string, namespace?: string | undefined): boolean {
    return this.get(name, namespace) !== undefined;
  }
  forEach(
    callbackfn: (
      value: string,
      name: QName,
      attributes: NamespaceAttributes,
    ) => void,
    thisArg: unknown = undefined,
  ) {
    for (const attribute of this.iter_()) {
      callbackfn.call(thisArg, attribute.value, getQName(attribute), this);
    }
  }
  *keys(): IterableIterator<QName> {
    for (const attribute of this.iter_()) {
      yield getQName(attribute);
    }
  }
  *values(): IterableIterator<string> {
    for (const attribute of this.iter_()) {
      yield attribute.value;
    }
  }
  *entries(): IterableIterator<[QName, string]> {
    for (const attribute of this.iter_()) {
      yield [getQName(attribute), attribute.value];
    }
  }
  [Symbol.iterator]() {
    return this.entries();
  }
}

/** @internal */
export type {NamespaceAttributes_};

function checkQName(name: string) {
  const colon = name.indexOf(":");
  if (
    colon !== -1 &&
    (colon === 0 ||
      colon === name.length - 1 ||
      name.indexOf(":", colon + 1) !== -1 ||
      !isNameStartChar(name.charCodeAt(colon + 1)))
  ) {
    throw new SaxError("InvalidQName");
  }
}

export const XML_NAMESPACE = "http://www.w3.org/XML/1998/namespace";
export const XMLNS_NAMESPACE = "http://www.w3.org/2000/xmlns/";

/** @internal */
class NamespaceResolver_ implements SaxReader, NamespaceResolver {
  // prefix -> namespace URI
  /** @internal */
  private namespaces_ = new Map<string, string>([
    ["xml", XML_NAMESPACE],
    ["xmlns", XMLNS_NAMESPACE],
  ]);
  // Depth number -> [prefix, shadowed ns or empty string, ...]
  // The root element is depth 1
  /** @internal */
  private prefixBindings_ = new Map<number, string[]>();
  // Required for faithful lookupPrefix
  /** @internal */
  private elementPrefixes_: string[] = [];
  /** @internal */
  private reader_: SaxNamespaceReader;
  constructor(reader: SaxNamespaceReader) {
    this.reader_ = reader;
  }
  lookupNamespace(prefix?: string | undefined): string | undefined {
    if (prefix === "") {
      return undefined;
    }
    return this.namespaces_.get(prefix ?? "");
  }
  lookupPrefix(namespace: string): string | undefined {
    if (namespace === "") {
      return undefined;
    }
    // These must be special cased because they may or must not be declared in
    // XML documents so there may not be a prefix explicitly associated to them.
    if (namespace === XML_NAMESPACE) {
      return "xml";
    }
    if (namespace === XMLNS_NAMESPACE) {
      return "xmlns";
    }
    // This function tries to be as faithful as possible to the DOM lookupPrefix
    // method, which uses the following procedure:
    // To locate a namespace prefix for an element using namespace, run these
    // steps:
    //   1. If element’s namespace is namespace and its namespace prefix is
    //   non-null, then return its namespace prefix.
    //   2. If element has an attribute whose namespace prefix is "xmlns" and
    //   value is namespace, then return element’s first such attribute’s local
    //   name.
    //   3. If element’s parent element is not null, then return the result of
    //   running locate a namespace prefix on that element using namespace.
    //   4. Return null.

    // To look at prefixes we have to backtrack in the namespaces table, so a
    // copy is necessary here, lookupPrefix is not expected to be called often
    // anyway and namespace declarations are usually very few.
    const namespaces = new Map(this.namespaces_);
    for (let depth = this.elementPrefixes_.length - 1; depth >= 0; depth--) {
      const prefix = this.elementPrefixes_[depth]!;
      const elementNamespace = namespaces.get(prefix);
      if (prefix !== "" && namespace === elementNamespace) {
        return prefix;
      }
      const bindings = this.prefixBindings_.get(depth);
      if (bindings !== undefined) {
        for (let i = 0; i < bindings.length; i += 2) {
          const prefix = bindings[i]!;
          const shadowed = bindings[i + 1]!;
          const boundNamespace = namespaces.get(prefix);
          if (prefix !== "" && namespace === boundNamespace) {
            return prefix;
          }
          // Update the namespace map as we progress back up the parent elements
          namespaces.set(prefix, shadowed);
        }
      }
    }
    return undefined;
  }
  xml?(declaration: XmlDeclaration) {
    return this.reader_.xml?.(declaration);
  }
  doctype?(doctype: Doctype) {
    // doctype name must match QName syntactically but it is not resolved
    // because it is not an element or attribute name
    checkQName(doctype.name);
    return this.reader_.doctype?.(doctype);
  }
  /** @internal */
  processingInstruction?(target: string, content: string) {
    return this.reader_.processingInstruction!(target, content);
  }
  /** @internal */
  comment?(text: string) {
    return this.reader_.comment!(text);
  }
  /** @internal */
  entityRef?(entityName: string) {
    return !!this.reader_.entityRef?.(entityName, this);
  }
  /** @internal */
  private parseQName_(name: string, isAttribute: boolean): QName {
    const colon = name.indexOf(":");
    if (
      colon === 0 || colon === name.length - 1 ||
      name.indexOf(":", colon + 1) !== -1 ||
      !isNameStartChar(name.charCodeAt(colon + 1))
    ) {
      throw new SaxError("InvalidQName", {
        attribute: isAttribute ? name : undefined,
        element: isAttribute ? undefined : name,
      });
    }
    const prefix = colon === -1 ? undefined : name.slice(0, colon);
    if (!isAttribute && prefix === "xmlns") {
      // xmlns must not appear as the prefix of element names
      throw new SaxError("ReservedPrefix", {element: name});
    }
    const localName = name.slice(colon + 1);
    const namespace = prefix === undefined && isAttribute
      // Attribute xmlns despite not having a prefix has the XMLNS namespace
      ? (name === "xmlns" ? XMLNS_NAMESPACE : undefined)
      : this.lookupNamespace(prefix);
    if (prefix !== undefined && namespace === undefined) {
      throw new SaxError("UndeclaredPrefix", {
        attribute: isAttribute ? name : undefined,
        element: isAttribute ? undefined : name,
      });
    }
    return {name, localName, prefix, namespace};
  }
  /** @internal */
  private handleAttributes_(attributes: Attributes): NamespaceAttributes {
    const nsAttributes = new NamespaceAttributes_();
    const bindings = [];
    // Collect namespaces first.
    for (const [name, value] of attributes) {
      if (
        name !== "xmlns" && name.slice(0, 6) !== "xmlns:" ||
        // Invalid prefixes will throw later.
        name.indexOf(":", 6) !== -1
      ) {
        continue;
      }
      const prefix = name.slice(6);
      if (prefix.slice(0, 3).toLowerCase() === "xml") {
        // xmlns must not be declared, xml may be declared but must be bound to
        // the same namespace.
        if (prefix === "xmlns" || prefix === "xml" && value !== XML_NAMESPACE) {
          throw new SaxError("ReservedPrefix", {attribute: name});
        }
        // Attempting to set a prefix starting with XML (case-insensitive) is
        // not allowed but they should not be used unless defined by other
        // specifications.
        continue;
      }
      // These namespaces are reserved and must not be bound to any other
      // prefix.
      if (value === XML_NAMESPACE || value === XMLNS_NAMESPACE) {
        throw new SaxError("ReservedNamespace", {attribute: name});
      }
      if (value === "") {
        throw new SaxError("PrefixUndeclaring", {attribute: name});
      }
      const shadowed = this.namespaces_.get(prefix);
      this.namespaces_.set(prefix, value);
      bindings.push(prefix, shadowed !== undefined ? shadowed : "");
    }
    if (bindings.length > 0) {
      this.prefixBindings_.set(this.elementPrefixes_.length, bindings);
    }
    for (const [name, value] of attributes) {
      const attribute = Object.assign(this.parseQName_(name, true), {value});
      nsAttributes.add_(attribute);
    }
    return nsAttributes;
  }
  /** @internal */
  private popPrefixes_() {
    this.elementPrefixes_.pop();
    const depth = this.elementPrefixes_.length;
    const bindings = this.prefixBindings_.get(depth);
    this.prefixBindings_.delete(depth);
    if (bindings !== undefined) {
      for (let i = 0; i < bindings.length; i += 2) {
        const prefix = bindings[i]!;
        const shadowed = bindings[i + 1]!;
        if (shadowed === "") {
          this.namespaces_.delete(prefix);
        } else {
          this.namespaces_.set(prefix, shadowed);
        }
      }
    }
  }
  startTag(name: string, attributes: Attributes) {
    const nsAttributes = this.handleAttributes_(attributes);
    const qName = this.parseQName_(name, false);
    this.elementPrefixes_.push(qName.prefix ?? "");
    this.reader_.startTag(qName, nsAttributes, this);
  }
  endTag(name: string) {
    this.reader_.endTag(this.parseQName_(name, false), this);
    this.popPrefixes_();
  }
  text(content: string, isCDataSection: boolean) {
    return this.reader_.text(content, isCDataSection, this);
  }
}

export interface SaxNamespaceOptions extends SaxOptions {
}

/**
 * A streaming SAX-style namespace-aware XML parser.
 *
 * `SaxNamespaceParser` works the same way as {@linkcode SaxParser} except
 * instead of plain strings it resolves namespace information and passes
 * {@linkcode QName} to the reader for element and attribute names.
 *
 * Additionally, document content handlers are provided with a
 * {@linkcode NamespaceResolver} to resolve namespaces and prefixes
 * at the current element.
 *
 * @see {@linkcode SaxParser}
 * @see {@linkcode SaxNamespaceOptions}
 * @see {@linkcode SaxNamespaceReader}
 * @see {@linkcode QName}
 * @see {@linkcode NamespaceResolver}
 */
export class SaxNamespaceParser extends SaxParser {
  constructor(
    reader: SaxNamespaceReader,
    options: SaxNamespaceOptions | undefined = undefined,
  ) {
    super(new NamespaceResolver_(reader), options);
    if (reader.processingInstruction == null) {
      this.flags_ &= ~Flags.CAPTURE_PI;
    }
    if (reader.comment == null) {
      this.flags_ &= ~Flags.CAPTURE_COMMENT;
    }
  }
  /** @internal */
  protected override readName_(): string {
    const name = super.readName_();
    checkQName(name);
    return name;
  }
  /** @internal */
  protected override checkNcName_(name: string): void {
    if (name.indexOf(":") !== -1) {
      throw new SaxError("InvalidNcName");
    }
  }
}
