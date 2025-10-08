import {SaxError} from "./error.ts";
import type {Doctype, SaxOptions, SaxReader, XmlDeclaration} from "./index.ts";
import {SaxParser} from "./index.ts";

export interface QName {
  /** Qualified name of the element or attribute,  */
  name: string;
  localName: string;
  prefix?: string | undefined;
  uri?: string | undefined;
}

/**
 * A namespace-aware, immutable view of the attributes of an XML tag.
 *
 * Attributes are iterable.
 */
export interface AttributesNs {
  /** The number of attributes. */
  readonly size: number;
  /**
   * @param name - Local name of the attribute. Qualified names are not
   * supported.
   * @param uri - Namespace URI for attributes with a namespace.
   * @returns - Returns the value of the attribute with the specified name and
   * namespace. If there is no attribute with the specified name `undefined` is
   * returned.
   */
  get(name: string, uri?: string | undefined): string | undefined;
  /**
   * @param name - Local name of the attribute.
   * @param uri - Namespace URI for attributes with a namespace.
   * @returns - Returns a boolean value indicating whether an attribute with the
   * specified name and namespace is present.
   */
  has(name: string, uri?: string | undefined): boolean;
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

interface AttributeNs extends QName {
  value: string;
}

// @internal
class AttributesNs_ implements AttributesNs {
  // @internal
  private map_ = new Map<string, AttributeNs>();
  // @internal
  clear_() {
    this.map_.clear();
  }
  // @internal
  add_(attribute: AttributeNs) {
    this.map_.set(
      attribute.uri != null
        ? `${attribute.uri}:${attribute.localName}`
        : attribute.localName,
      attribute,
    );
  }
  iter_() {
    return this.map_.values();
  }
  get size() {
    return this.map_.size;
  }
  get(name: string, uri?: string | undefined): string | undefined {
    // Name must be an NCName
    if (name.indexOf(":") !== -1) {
      return undefined;
    }
    return this.map_.get(uri != null ? `${uri}:${name}` : name)?.value;
  }
  has(name: string, uri?: string | undefined): boolean {
    // AttributeNs is never undefined.
    return this.get(name, uri) !== undefined;
  }
  keys(): IterableIterator<QName> {
    return this.iter_();
  }
  *values(): Generator<string> {
    for (const attribute of this.iter_()) {
      yield attribute.value;
    }
  }
  *entries(): Generator<[QName, string]> {
    for (const attribute of this.iter_()) {
      yield [attribute, attribute.value];
    }
  }
  [Symbol.iterator]() {
    return this.entries();
  }
}

export interface SaxReaderNs
  extends Omit<SaxReader, "start" | "empty" | "end">
{
  getNamespace?(name: Omit<QName, "uri">): string | undefined;
  start(name: QName, attributes: AttributesNs): void;
  empty(name: QName, attributes: AttributesNs): void;
  end(name: QName): void;
}

function checkQName(name: string) {
  const colon = name.indexOf(":");
  if (
    colon !== -1 &&
    (colon === 0 || colon === name.length - 1 ||
      name.indexOf(":", colon + 1) !== -1)
  ) {
    throw new SaxError("INVALID_QNAME");
  }
}

// @internal
class SaxNsReader implements SaxReader {
  // prefix name -> URI (the last is the most recent)
  // @internal
  private namespaces_ = new Map<string, string[]>([
    ["xml", ["http://www.w3.org/XML/1998/namespace"]],
    ["xmlns", ["http://www.w3.org/2000/xmlns/"]],
  ]);
  // Depth number -> prefix names
  // @internal
  private nsPrefixes_ = new Map<number, string[]>();
  // @internal
  private depth_ = 0;
  // Reused across calls
  // @internal
  private attributes_ = new AttributesNs_();
  // @internal
  private reader_: SaxReaderNs;
  constructor(reader: SaxReaderNs) {
    this.reader_ = reader;
    // @ts-expect-error -- exactOptionalPropertyTypes does not allow setting optional methods to undefined
    this.processingInstruction = this.reader_.processingInstruction != null
      ? this.processingInstruction
      : undefined;
    // @ts-expect-error -- exactOptionalPropertyTypes does not allow setting optional methods to undefined
    this.comment = this.reader_.comment != null ? this.comment : undefined;
    // @ts-expect-error -- exactOptionalPropertyTypes does not allow setting optional methods to undefined
    this.entityRef = this.reader_.entityRef != null
      ? this.entityRef
      : undefined;
  }
  xml?(declaration: XmlDeclaration) {
    return this.reader_.xml?.(declaration);
  }
  doctype?(doctype: Doctype) {
    // doctype name must match QName syntactically but is not resolved because it is
    // not an element or attribute name
    checkQName(doctype.name);
    return this.reader_.doctype?.(doctype);
  }
  processingInstruction?(target: string, content: string) {
    return this.reader_.processingInstruction!(target, content);
  }
  comment?(text: string) {
    return this.reader_.comment!(text);
  }
  getGeneralEntity?(entityName: string) {
    return this.reader_.getGeneralEntity?.(entityName);
  }
  entityRef?(entityName: string) {
    return this.reader_.entityRef!(entityName);
  }
  // @internal
  private parseQName_(name: string, isAttribute: boolean): QName {
    const colon = name.indexOf(":");
    if (
      colon === 0 || colon === name.length - 1 ||
      name.indexOf(":", colon + 1) !== -1
    ) {
      throw new SaxError("INVALID_QNAME");
    }
    const prefix = colon === -1 ? undefined : name.slice(0, colon);
    const localName = name.slice(colon + 1);
    const uris = prefix === undefined && isAttribute
      ? undefined
      : this.namespaces_.get(prefix ?? "");
    let uri = uris !== undefined ? uris[uris.length - 1] : undefined;
    if (uri === undefined) {
      uri = this.reader_.getNamespace?.({name, localName, prefix});
    }
    if (prefix !== undefined && uri === undefined) {
      throw new SaxError("UNDECLARED_PREFIX");
    }
    return {name, localName, prefix, uri};
  }
  // @internal
  private handleAttributes_(
    attributes: ReadonlyMap<string, string>,
  ): AttributesNs {
    this.attributes_.clear_();
    const prefixes = [];
    for (const [name, value] of attributes.entries()) {
      // Collect namespaces first
      if (name !== "xmlns" && name.slice(0, 6) !== "xmlns:") {
        continue;
      }
      if (name.indexOf(":", 6) !== -1) {
        throw new Error("invalid prefix");
      }
      const prefix = name.slice(6);
      if (prefix === "xmlns" || prefix === "xml") {
        throw new Error("namespace not valid");
      }
      let ns = this.namespaces_.get(prefix);
      if (ns === undefined) {
        ns = [value];
        this.namespaces_.set(prefix, ns);
      }
      prefixes.push(prefix);
    }
    if (prefixes.length !== 0) {
      this.nsPrefixes_.set(this.depth_, prefixes);
    }
    for (const [name, value] of attributes.entries()) {
      const attribute = Object.assign({value}, this.parseQName_(name, true));
      this.attributes_.add_(attribute);
    }
    return this.attributes_;
  }
  // @internal
  private popPrefixes_() {
    const prefixes = this.nsPrefixes_.get(this.depth_);
    this.nsPrefixes_.delete(this.depth_);
    this.depth_--;
    const length = prefixes?.length ?? 0;
    for (let i = 0; i < length; i++) {
      const uris = this.namespaces_.get(prefixes![i]!)!;
      uris.pop();
      if (uris.length === 0) {
        this.namespaces_.delete(prefixes![i]!);
      }
    }
  }
  start(name: string, attributes: ReadonlyMap<string, string>) {
    this.depth_ += 1;
    const attributesNs = this.handleAttributes_(attributes);
    const qName = this.parseQName_(name, false);
    this.reader_.start(qName, attributesNs);
  }
  empty(name: string, attributes: ReadonlyMap<string, string>) {
    this.depth_ += 1;
    const attributesNs = this.handleAttributes_(attributes);
    const qName = this.parseQName_(name, false);
    this.reader_.empty(qName, attributesNs);
    this.popPrefixes_();
  }
  end(name: string) {
    this.reader_.end(this.parseQName_(name, false));
    this.popPrefixes_();
  }
  text(text: string) {
    return this.reader_.text(text);
  }
}

export class SaxParserNs extends SaxParser {
  constructor(
    reader: SaxReaderNs,
    options: SaxOptions | undefined = undefined,
  ) {
    super(new SaxNsReader(reader), options);
  }
  // @internal
  protected override readName_(): string {
    const name = super.readName_();
    checkQName(name);
    return name;
  }
  // @internal
  protected override checkNCName_(name: string): void {
    if (name.indexOf(":") !== -1) {
      throw new SaxError("INVALID_NCNAME");
    }
  }
}
