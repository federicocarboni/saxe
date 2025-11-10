import {isNameStartChar} from "./chars.ts";
import {SaxError} from "./error.ts";
import type {
  Attributes,
  Doctype,
  SaxHandler,
  SaxLexicalHandler,
  SaxOptions,
  XmlDeclaration,
} from "./parser.ts";
import {Flags, SaxParser} from "./parser.ts";

/** A qualified XML name for elements or attributes. */
export interface QName {
  /** Qualified name of the element or attribute. */
  readonly name: string;
  /** Local part of the name. */
  readonly localName: string;
  /** Prefix part of the name, if any. */
  readonly prefix?: string | undefined;
  /** Namespace URI, if any. */
  readonly namespace?: string | undefined;
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
   * @param localName - Local name of the attribute. Qualified names are not
   * supported.
   * @param namespace - Namespace URI for attributes with a namespace.
   * @returns - Returns the value of the attribute with the specified name and
   * namespace. If there is no attribute with the specified name and namespace
   * `undefined` is returned.
   */
  get(localName: string, namespace?: string | undefined): string | undefined;
  /**
   * Returns `true` if the specified attribute is present, `false` otherwise.
   * @param localName - Local name of the attribute.
   * @param namespace - Namespace URI for attributes with a namespace.
   * @returns - Returns a boolean value indicating whether an attribute with the
   * specified name and namespace is present.
   */
  has(localName: string, namespace?: string | undefined): boolean;
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
   * {@linkcode SaxNamespaceHandler.startTag}.
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
   * {@linkcode SaxNamespaceHandler.startTag}.
   *
   * [DOM Node `lookupPrefix`]:
   * https://dom.spec.whatwg.org/#dom-node-lookupprefix
   * @param namespace - Namespace URI to look for.
   * @returns - Returns the prefix for the given namespace URI, if present, or
   * returns `undefined` if it is not.
   */
  lookupPrefix(namespace: string): string | undefined;
}

export interface SaxNamespaceHandler extends SaxLexicalHandler {
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
   * Text content.
   *
   * ```xml
   * <element>
   *   content
   * </element>
   * ```
   *
   * This handler is equivalent to {@linkcode SaxHandler.text} except it has
   * access to the namespace resolver of the current element.
   * @param content - Text content.
   * @param resolver - Namespace resolver relative to the current element,
   * should not be used outside the handler.
   */
  text(
    content: string,
    resolver: NamespaceResolver,
  ): void;
}

/** @internal */
class QName_ implements QName {
  constructor(
    readonly name: string,
    readonly localName: string,
    readonly prefix?: string | undefined,
    readonly namespace?: string | undefined,
  ) {}
}

/** @internal */
class NamespaceAttributes_ implements NamespaceAttributes {
  /** @internal */
  private map_: Map<string, [QName, string]>;
  constructor() {
    this.map_ = new Map();
  }
  /** @internal */
  add_(name: QName, value: string) {
    const key = name.namespace !== undefined
      ? `${name.namespace}:${name.localName}`
      : name.localName;
    if (this.map_.has(key)) {
      throw new SaxError("AttributeRedefined", {attribute: name.name});
    }
    this.map_.set(key, [name, value]);
  }
  get size() {
    return this.map_.size;
  }
  get(localName: string, namespace?: string | undefined): string | undefined {
    // Name must be an NCName
    if (localName.indexOf(":") !== -1) {
      return undefined;
    }
    const key = namespace != null ? `${namespace}:${localName}` : localName;
    const attribute = this.map_.get(key);
    return attribute !== undefined ? attribute[1] : undefined;
  }
  has(localName: string, namespace?: string | undefined): boolean {
    return this.get(localName, namespace) !== undefined;
  }
  forEach(
    callbackfn: (
      value: string,
      name: QName,
      attributes: NamespaceAttributes,
    ) => void,
    thisArg: unknown = undefined,
  ) {
    for (const [name, value] of this.map_.values()) {
      callbackfn.call(thisArg, value, name, this);
    }
  }
  *keys(): IterableIterator<QName> {
    for (const [name] of this.map_.values()) {
      yield name;
    }
  }
  *values(): IterableIterator<string> {
    for (const [, value] of this.map_.values()) {
      yield value;
    }
  }
  *entries(): IterableIterator<[QName, string]> {
    for (const attribute of this.map_.values()) {
      yield attribute;
    }
  }
  [Symbol.iterator]() {
    return this.entries();
  }
}

/**
 * Returns `true` if the provided name is a well-formed *QName*. `name` must
 * be a well-formed *Name*.
 * @internal
 */
function isNameWellFormedQName(name: string) {
  const colon = name.indexOf(":");
  return colon === -1 ||
    colon !== 0 && colon !== name.length - 1 &&
      name.indexOf(":", colon + 1) === -1 &&
      isNameStartChar(name.codePointAt(colon + 1)!);
}

export const XML_NAMESPACE = "http://www.w3.org/XML/1998/namespace";
export const XMLNS_NAMESPACE = "http://www.w3.org/2000/xmlns/";

/** @internal */
class NamespaceResolver_ implements SaxHandler, NamespaceResolver {
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
  private handler_: SaxNamespaceHandler;
  constructor(handler: SaxNamespaceHandler) {
    this.handler_ = handler;
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
  xmlDecl?(declaration: XmlDeclaration) {
    return this.handler_.xmlDecl?.(declaration);
  }
  doctype?(doctype: Doctype) {
    return this.handler_.doctype?.(doctype);
  }
  /** @internal */
  processingInstruction?(target: string, content: string) {
    return this.handler_.processingInstruction!(target, content);
  }
  /** @internal */
  comment?(text: string) {
    return this.handler_.comment!(text);
  }
  /** @internal */
  startCDataSection?(): void {
    return this.handler_.startCDataSection?.();
  }
  /** @internal */
  endCDataSection?(): void {
    return this.handler_.endCDataSection?.();
  }
  /** @internal */
  private parseQName_(name: string, isAttribute: boolean): QName {
    if (!isNameWellFormedQName(name)) {
      throw new SaxError(
        "InvalidQName",
        isAttribute ? {attribute: name} : {element: name},
      );
    }
    const colon = name.indexOf(":");
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
      throw new SaxError(
        "UndeclaredPrefix",
        isAttribute ? {attribute: name} : {element: name},
      );
    }
    return new QName_(name, localName, prefix, namespace);
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
      // xmlns must not be declared, xml may be declared but must be bound to
      // the same namespace.
      if (prefix === "xmlns" || prefix === "xml" && value !== XML_NAMESPACE) {
        throw new SaxError("ReservedPrefix", {attribute: name});
      }
      if (prefix === "xml") {
        continue;
      }
      // These namespaces are reserved and must not be bound to any other
      // prefix.
      if (value === XML_NAMESPACE || value === XMLNS_NAMESPACE) {
        throw new SaxError("ReservedNamespace", {attribute: name});
      }
      if (value === "" && prefix !== "") {
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
      nsAttributes.add_(this.parseQName_(name, true), value);
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
    this.handler_.startTag(qName, nsAttributes, this);
  }
  endTag(name: string) {
    this.handler_.endTag(this.parseQName_(name, false), this);
    this.popPrefixes_();
  }
  text(content: string) {
    return this.handler_.text(content, this);
  }
}

export interface SaxNamespaceOptions extends SaxOptions {
}

/**
 * A streaming SAX-style namespace-aware XML parser.
 *
 * `SaxNamespaceParser` works the same way as {@linkcode SaxParser} except
 * instead of plain strings it resolves namespace information and passes
 * {@linkcode QName} to the handler for element and attribute names.
 *
 * Additionally, document content handlers are provided with a
 * {@linkcode NamespaceResolver} to resolve namespaces and prefixes
 * at the current element.
 *
 * @see {@linkcode SaxParser}
 * @see {@linkcode SaxNamespaceOptions}
 * @see {@linkcode SaxNamespaceHandler}
 * @see {@linkcode QName}
 * @see {@linkcode NamespaceResolver}
 */
export class SaxNamespaceParser extends SaxParser {
  constructor(
    handler: SaxNamespaceHandler,
    options: SaxNamespaceOptions | undefined = undefined,
  ) {
    super(new NamespaceResolver_(handler), options);
    if (handler.processingInstruction == null) {
      this.flags_ &= ~Flags.CAPTURE_PI;
    }
    if (handler.comment == null) {
      this.flags_ &= ~Flags.CAPTURE_COMMENT;
    }
  }
  /** @internal */
  protected override checkQName_(name: string) {
    if (!isNameWellFormedQName(name)) {
      throw new SaxError("InvalidQName");
    }
  }
  /** @internal */
  protected override checkNcName_(name: string): void {
    if (name.indexOf(":") !== -1) {
      throw new SaxError("InvalidNcName");
    }
  }
}
