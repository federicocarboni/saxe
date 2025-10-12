/** */

import {
  Chars,
  hasInvalidChar,
  isChar,
  isNameChar,
  isNameStartChar,
  isWhiteSpace,
} from "./chars.ts";
import {SaxError} from "./error.ts";
import {parseXmlDecl} from "./xml_decl.ts";

export {SaxError, type SaxErrorName} from "./error.ts";

/**
 * XML declaration (XMLDecl).
 *
 * ```xml
 * <?xml version="1.0" encoding="UTF-8" standalone="no" ?>
 * ```
 */
export interface XmlDeclaration {
  /**
   * Version declared in the XML Declaration. Generally `1.0` or `1.1`.
   * @since 1.0.0
   */
  version: string;
  /**
   * Encoding in the XML Declaration, or `undefined` when unspecified. The
   * encoding label is converted to lower case to be consistent with the
   * `encoding` property of `TextDecoder`, and ensures encoding labels are
   * processed in a case-insensitive way.
   *
   * The parser does not validate that the encoding label is one of the
   * officially assigned [IANA Character Sets] nor does it resolve aliases.
   *
   * [IANA Character Sets]:
   * https://www.iana.org/assignments/character-sets/character-sets.xhtml
   */
  encoding?: string | undefined;
  /**
   * Standalone value declared in the XML Declaration.
   *
   * `true` when set to `yes`, `false` when set to `no`, or `undefined` when
   * unspecified.
   *
   * #### [VC: Standalone Document Declaration]
   * The standalone document declaration MUST have the value "no" if any
   * external markup declarations contain declarations of:
   *
   * - attributes with default values, if elements to which these attributes
   *   apply appear in the document without specifications of values for these
   *   attributes, or
   * - entities (other than `amp`, `lt`, `gt`, `apos`, `quot`), if references to
   *   those entities appear in the document, or
   * - attributes with tokenized types, where the attribute appears in the
   *   document with a value such that normalization will produce a different
   *   value from that which would be produced in the absence of the
   *   declaration, or
   * - element types with element content, if white space occurs directly within
   *   any instance of those types.
   */
  standalone?: boolean | undefined;
}

/**
 * Document type declaration (doctypedecl).
 *
 * ```xml
 * <!DOCTYPE example PUBLIC "-//Example//example doc" "http://example.org/example.dtd">
 * ```
 */
export interface Doctype {
  /**
   * Name in the document type declaration.
   *
   * #### [VC: Root Element Type]
   * The Name in the document type declaration MUST match the element type of
   * the root element.
   */
  name: string;
  /**
   * Public identifier in the document type declaration, if present.
   *
   * All strings of white space in the public identifier are normalized to
   * single space characters, and leading and trailing white space is removed.
   */
  publicId?: string | undefined;
  /**
   * System identifier in the document type declaration, if present.
   *
   * It is meant to be converted to a URI reference relative to the document
   * entity, the parser does not process it as external markup declarations are
   * not supported.
   *
   * System identifiers may contain characters that, according to
   * [IETF RFC 3986], must be escaped before a URI can be used to retrieve the
   * referenced resource.
   *
   * [IETF RFC 3986]: https://www.ietf.org/rfc/rfc3986.txt
   */
  systemId?: string | undefined;
}

/**
 * An immutable collection of the attributes of an XML tag.
 *
 * Attributes are iterable and ordered as specified in the XML tag. Default
 * attributes from internal declarations are positioned after explicitly
 * specified attributes.
 */
export interface Attributes {
  /** The number of attributes. */
  readonly size: number;
  /**
   * @param name - Name of the attribute.
   * @returns - Returns the value of the attribute with the specified name.
   * If there is no attribute with the specified name `undefined` is returned.
   */
  get(name: string): string | undefined;
  /**
   * @param name - Name of the attribute.
   * @returns - Returns a boolean value indicating whether an attribute with the
   * specified name is present.
   */
  has(name: string): boolean;
  /**
   * Executes `callbackfn` for each attribute.
   * @param callbackfn -
   * @param thisArg -
   */
  forEach(
    callbackfn: (value: string, name: string, attributes: Attributes) => void,
    thisArg?: unknown,
  ): void;
  /** @returns - Returns an iterator over the names of the attributes. */
  keys(): IterableIterator<string>;
  /** @returns - Returns an iterator over the values of the attributes. */
  values(): IterableIterator<string>;
  /**
   * @returns - Returns an iterator over the names and values of the attributes.
   */
  entries(): IterableIterator<[string, string]>;
  [Symbol.iterator](): IterableIterator<[string, string]>;
}

interface BaseReader {
  /**
   * XML declaration of the document.
   * @param declaration -
   */
  xml?(declaration: XmlDeclaration): void;
  /**
   * Document type declaration.
   *
   * If the internal DTD subset is present, this handler is called before
   * parsing it.
   * @param doctype -
   */
  doctype?(doctype: Doctype): void;
  /**
   * A processing instruction.
   *
   * ```xml
   * <?target content?>
   * ```
   *
   * Unless processing instructions are required, avoid defining this handler as
   * that will prevent the parser from buffering their content.
   * Processing instructions are always checked for well-formedness regardless
   * of the configuration.
   * @param target -
   * @param content -
   */
  processingInstruction?(target: string, content: string): void;
  /**
   * A comment.
   *
   * ```xml
   * <!-- text -->
   * ```
   *
   * Unless processing comments is required, avoid defining this handler as that
   * will prevent the parser from buffering the comment contents. Comments are
   * always checked for well-formedness regardless of the configuration.
   * @param text - Comment text, leading or trailing spaces are not removed.
   */
  comment?(text: string): void;
}

/**
 * https://www.w3.org/TR/REC-xml/
 * @since 1.0.0
 */
export interface SaxReader extends BaseReader {
  /**
   * Start tag.
   *
   * ```xml
   * <element attr="value">
   * ```
   * @param name - Name of the element.
   * @param attributes - Attributes of the tag. Only valid for the
   * duration of this call, implementors should make a copy to persist
   * attributes.
   */
  startTag(name: string, attributes: Attributes): void;
  /**
   * An empty tag.
   *
   * ```xml
   * <element attr="value" />
   * ```
   * @param name - Name of the element.
   * @param attributes - Attributes of the tag. Only valid for the
   * duration of this call, implementors should make a copy to persist
   * attributes.
   */
  emptyTag(name: string, attributes: Attributes): void;
  /**
   * An end tag.
   *
   * ```xml
   * </element>
   * ```
   * @param name - Name of the element.
   */
  endTag(name: string): void;
  /**
   * A general entity reference in document content for which the parser has no
   * declarations. Undeclared entities in attribute values are always an error.
   *
   * ```xml
   * <root>
   *   &entity;
   * </root>
   * ```
   *
   * This function is intended to be called only for references to undeclared
   * entities. If the replacement text of entities can be provided, consider
   * using {@linkcode SaxOptions.entityProvider} instead so that entities are
   * expanded automatically.
   *
   * @param name - Name of the entity.
   * @returns - Returns `true` if entity `name` was recognized. If the function
   * is not defined or returns `false` the parser throws an `UndeclaredEntity`
   * error.
   */
  entityRef?(name: string): boolean;
  /**
   * Text content.
   *
   * ```xml
   * <element>
   *   content
   * </element>
   * ```
   *
   * By default, the parser collects text content as if it were forming a DOM
   * Text Node. {@linkcode SaxOptions.incompleteTextNodes} may be used to emit
   * text events as soon as more data is available.
   *
   * Entity references not recognized by the parser are handled in
   * {@linkcode entityRef}.
   * @param content - Text content.
   * @param isCdataSection - Boolean value `true` if content originated from a
   * CDATA section or `false` if it is regular character data.
   */
  text(content: string, isCdataSection: boolean): void;
}

export interface EntityProvider {
  /**
   * Returns the replacement text of an external entity or an entity declared in
   * external markup declarations. Returns `undefined` for entity names with no
   * declaration.
   *
   * Note that replacement text is not treated as literal *plain* text, it is
   * parsed as *markup*, so it may contain elements, character references, or
   * even other entity references.
   *
   * If the entity value should be treated as literal plain text it should be
   * escaped with {@linkcode escape} before returning it.
   *
   * ## Example
   *
   * ```js
   * getEntity(name) {
   *   if (name === "foo") {
   *     // Parsed as start tag 'bar', entity ref 'baz', end tag 'bar'
   *     return "<bar>&baz;</bar>";
   *   }
   *   if (name === "boo") {
   *     // Parsed as the literal text '<bar>&baz;</bar>'
   *     return escape("<bar>&baz;</bar>");
   *   }
   *   return undefined;
   * }
   * ```
   * @param name - Name of the entity.
   * @returns - Returns the replacement text of the specified entity.
   */
  getEntity(name: string): string | undefined;
}

/**
 * @since 1.0.0
 */
export interface SaxOptions {
  /**
   * Customize behavior for Document Type Declarations. Users may want to
   * disable doctypes because certain protocols prohibit them or for safer
   * processing.
   *
   * - `"process"` - internal DTD is processed, i.e. attribute lists are read
   * and processed to set default attribute values and normalize attributes
   * correctly, internal entities are read and expanded as needed.
   * External DTD identifiers are passed to the application. External entities
   * and external declarations are not read or processed.
   * - `"prohibit"` - throw an error if the document has any DTD, including
   * external DTDs, i.e. `<!DOCTYPE any>` immediately aborts parsing. Throws
   * `InvalidDoctypeDecl`.
   * - `"ignore"` - internal DTD is not processed but is still checked for
   * well-formedness, i.e. internal entity references are not expanded
   * automatically but a syntax error still throws. External DTD identifiers are
   * still passed to the application.
   * @default "process"
   */
  dtd?: "process" | "prohibit" | "ignore" | undefined;
  // Limiting the memory usage of the parser is one of, if not the, most
  // important security proofing step for XML.
  // https://web.archive.org/web/20240318075117/https://learn.microsoft.com/en-us/archive/msdn-magazine/2009/november/xml-denial-of-service-attacks-and-defenses
  /**
   * Maximum size allowed for a markup identifier. Applies to tag names, public
   * and system identifiers.
   * @default 2_000
   */
  maxNameLength?: number | undefined;
  /**
   * Maximum size allowed for an attribute map.
   * @default 2_000
   */
  maxAttributes?: number | undefined;
  /**
   * Maximum size allowed for a text node.
   *
   * Also applies to comments and processing instruction content when they are
   * collected.
   * @default 10_000_000
   */
  maxTextLength?: number | undefined;
  /**
   * Maximum size allowed for an entity value, including nested entities.
   * @default 1_000_000
   */
  maxEntityLength?: number | undefined;
  /**
   * Maximum nesting depth allowed for entities.
   * @default 10
   */
  maxEntityDepth?: number | undefined;
  /**
   * An entity provider to use when the parser has no declaration for an entity.
   */
  entityProvider?: EntityProvider | undefined;
  /**
   * Emit {@linkcode SaxReader.text} as soon as data becomes available.
   *
   * By default, the parser collects text content as it were forming a DOM Text
   * Node (or CDATA Section Node), even when text spans multiple chunks. This
   * makes the parser more predictable but delays output until the ending chunk
   * is reached.
   *
   * Enabling this option prevents any buffering and causes the parser to emit
   * {@linkcode SaxReader.text} as soon as data becomes available.
   * @default false
   */
  incompleteTextNodes?: boolean | undefined;
}

const enum State {
  INIT,
  XML_DECL,
  DOCTYPE_DECL_START,
  DOCTYPE_DECL,
  DOCTYPE_NAME,
  DOCTYPE_NAME_END,
  EXTERNAL_ID,
  EXTERNAL_ID_SYSTEM_SPACE,
  EXTERNAL_ID_QUOTED_START,
  EXTERNAL_ID_QUOTED,
  DOCTYPE_MAYBE_INTERNAL_SUBSET,
  INTERNAL_SUBSET,
  INTERNAL_SUBSET_PE_REF_START,
  INTERNAL_SUBSET_PE_REF,
  INTERNAL_SUBSET_OPEN_ANGLE,
  INTERNAL_SUBSET_OPEN_ANGLE_BANG,
  INTERNAL_SUBSET_DECL,
  INTERNAL_SUBSET_DECL_QUOTED,
  DOCTYPE_END,
  MISC,
  PI_TARGET_START,
  PI_TARGET,
  PI_CONTENT_START,
  PI_CONTENT,
  PI_CONTENT_END,
  PI_END,
  COMMENT_START,
  COMMENT,
  COMMENT_HYPHEN,
  COMMENT_END,
  OPEN_ANGLE_BRACKET,
  OPEN_ANGLE_BRACKET_BANG,
  START_TAG_NAME,
  START_TAG,
  START_TAG_SPACE,
  START_TAG_ATTR,
  START_TAG_ATTR_EQ,
  START_TAG_ATTR_VALUE,
  START_TAG_ATTR_VALUE_QUOTED,
  EMPTY_TAG,
  TEXT_CONTENT,
  REFERENCE,
  ENTITY_REF,
  CHAR_REF,
  CHAR_REF_DEC,
  CHAR_REF_HEX,
  CDATA_SECTION_START,
  CDATA_SECTION,
  CDATA_SECTION_END0,
  CDATA_SECTION_END,
  END_TAG_START,
  END_TAG,
  END_TAG_END,
}

// A bit of an abuse of const enum
const enum Flags {
  INIT = 0,

  // Option flags, these are turned on or off depending on SaxReader and
  // SaxOptions and do not change as more input is read.

  // Capture Processing Instructions or ignore them.
  CAPTURE_PI = 1 << 0,
  // Capture Comments or ignore them.
  CAPTURE_COMMENT = 1 << 1,
  EMIT_CDATA_SECTION = 1 << 2,
  // These are boolean properties in SaxOptions
  OPT_INCOMPLETE_TEXT_NODES = 1 << 3,
  // OPT_TEXT_ONLY_ENTITIES = 1 << 4,

  // Runtime flags:
  SEEN_DOCTYPE = 1 << 4,
  SEEN_ROOT = 1 << 5,
  EXTERNAL_ID_PUBLIC = 1 << 6,
  EXTERNAL_ID_SYSTEM = 1 << 7,
  IGNORE_INT_SUBSET_DECL = 1 << 8,
  PROHIBIT_DOCTYPE_DECL = 1 << 9,
}

// Normalize XML line endings.
function normalizeLineEndings(s: string) {
  return s.replace(/\r\n?/g, "\n");
}

// @internal
interface AttDef {
  // Default value for the attribute
  default_: string | undefined;
  // true if the attribute is TokenizedType or EnumeratedType,
  // requiring extra normalization steps
  isTokenized_: boolean;
}

// https://www.w3.org/TR/REC-xml/#AVNormalize
function normalizeAttributeValue(s: string) {
  // If the attribute type is not CDATA, then the XML processor
  // MUST further process the normalized attribute value by
  // discarding any leading and trailing space (#x20) characters,
  // and by replacing sequences of space (#x20) characters by
  // a single space (#x20) character.
  // Using a regex here saves a lot of space and is decently
  // fast.
  return s.replace(/^ +| +$| +(?= )/g, "");
}

const ATT_TYPES = [
  // CDATA is checked for manually
  // "CDATA",
  "ID",
  "IDREF",
  "IDREFS",
  "ENTITY",
  "ENTITIES",
  "NMTOKEN",
  "NMTOKENS",
];

const ATT_DEFAULT_DECLS = ["#REQUIRED", "#IMPLIED", "#FIXED"];

const enum EntityDecl {
  EXTERNAL = 1,
  UNPARSED,
}

// Even if predefined entities are declared somewhere in a DTD
// they MUST have replacement text that produces text exactly
// equal to the predefined ones, so we can treat them essentially
// the same as a char reference.
// https://www.w3.org/TR/REC-xml/#sec-predefined-ent
const PREDEFINED_ENTITIES = {
  amp: "&",
  lt: "<",
  gt: ">",
  apos: "'",
  quot: '"',
} as const;

function escapeChar(c: string): string {
  switch (c) {
    case "&":
      return "&amp;";
    case "<":
      return "&lt;";
    case ">":
      return "&gt;";
    case "'":
      return "&apos;";
    case '"':
      return "&quot;";
    case "\t":
      return "&#9;";
    case "\n":
      return "&#10;";
    case "\r":
      return "&#13;";
    default:
      return `${c.codePointAt(0)}`;
  }
}

/**
 * Escapes XML markup characters in the given string.
 *
 * XML markup is escaped using their predefined entity if there is one, or a
 * decimal character reference.
 *
 * - `&` -> `&amp;`
 * - `<` -> `&lt;`
 * - `>` -> `&gt;`
 * - `'` -> `&apos;`
 * - `"` -> `&quot;`
 * - `\t` (TAB) -> `&#9;`
 * - `\n` (LF) -> `&#10;`
 * - `\r` (CR) -> `&#13;`
 *
 * @param s - Input string to be escaped.
 * @returns - A new string where all XML markup characters are replaced with
 * their escape sequence.
 *
 * @example
 * ```ts
 * const unsafe = "<div>This & that</div>";
 * const safe = escape(unsafe);
 * console.log(safe); // &lt;div&gt;This &amp; that&lt;/div&gt;
 * ```
 */
export function escape(s: string) {
  return s.replace(/[&<>'"\t\n\r]/g, escapeChar);
}

export function parse(
  input: string,
  reader: SaxReader,
  options: SaxOptions | undefined = undefined,
) {
  const parser = new SaxParser(reader, options);
  parser.write(input);
  parser.end();
}

const EXTERNAL_OR_PUBLIC_ID_RE =
  /^(?:SYSTEM|PUBLIC[ \t\n\r]+("|')([ \n\ra-zA-Z0-9-'()+,./:=?;!*#@$_%]*?)\1)(?:[ \t\n\r]+("|')([\t\n\r -\uFFFD]*?)\3)?/;

/**
 * Streaming non-validating XML Parser, it makes no attempt to recover
 * well-formedness errors.
 *
 * To optimize for efficiency the parser does not store line information.
 * @since 1.0.0
 */
export class SaxParser {
  // Private properties and methods of this class are mangled at build time to
  // reduce bundle size, so they are completely inaccessible to the public API.
  // Reading this code requires knowledge of the XML standard and the JavaScript
  // string representation.
  // Code comments refer to the 16-bit JavaScript character unit as code unit.
  // Code point, Unicode character or just character refer instead to a Unicode
  // character including the full range of U+0000 to U+10FFFF.
  // Astral plane characters are fully supported (as required by the XML
  // standards) but `codePointAt` is avoided where possible as it is much
  // slower than `charCodeAt`.

  // @internal
  private reader_: SaxReader;
  // @internal
  private entityProvider_: EntityProvider | undefined;

  // Options
  // @internal
  private maxNameLength_: number;
  // @internal
  private maxAttributes_: number;
  // @internal
  private maxTextLength_: number;
  // @internal
  private maxEntityLength_: number;
  // @internal
  private maxEntityDepth_: number;

  // @internal
  private offset_ = 0;
  // State
  // @internal
  private chunk_ = "";
  // @internal
  private index_ = 0;
  // @internal
  private state_ = State.INIT;
  // @internal
  private otherState_ = 0;
  // Stores flags and boolean options.
  // @internal
  protected flags_ = Flags.INIT;
  // @internal
  private charRef_ = 0;
  // @internal
  private quote_ = -1;
  // @internal
  private entityLength_ = 0;
  // Current text node length in code units. Required for when
  // incompleteTextNodes is enabled.
  // @internal
  private textLength_ = 0;

  // @internal
  private elements_: string[] = [];

  // Stack of entities currently expanded, required for the WFC No Recursion and
  // to limit the depth of entity expansion allowed.
  // @internal
  private entityStack_: string[] = [];

  // Accumulators

  // Generic accumulator
  // Current element name
  // @internal
  private element_ = "";
  // Current text content, contains decoded and normalized content
  // or current attribute value (or XML Decl attribute value)
  // @internal
  private content_ = "";
  // Current attribute name (or XML Decl attribute value)
  // @internal
  private attribute_ = "";
  // @internal
  private entity_ = "";
  // Current attributes, this parser enforces well-formedness so an attribute
  // list cannot be avoided. To improve lookup times it uses a Map instead of a
  // plain object.
  // @internal
  private attributes_ = new Map<string, string>();

  // Internal entities declared in the internal subset.
  // @internal
  private entities_ = new Map<string, string | EntityDecl>();
  // Attlists declared in the internal subset.
  // @internal
  private attlists_ = new Map<string, Map<string, AttDef>>();

  // TODO: Namespace support?
  // readonly namespaces: ReadonlyMap<string, string>;
  // TODO: xml:space and xml:lang support?
  // /**
  //  * `xml:space` attribute.
  //  */
  // readonly xmlSpace?: "preserve" | "default" | undefined;
  // /**
  //  * `xml:lang` attribute.
  //  */
  // readonly xmlLang?: string | undefined;

  // XML Declaration attributes are held onto because they may be useful
  // (e.g. XML 1.1) in the future?
  // // @internal
  // private version_: string | undefined = undefined;
  // // @internal
  // private encoding_: string | undefined = undefined;
  // @internal
  private standalone_: boolean | undefined = undefined;

  /**
   * Create a new XML parser.
   * @param reader -
   * @param options -
   */
  constructor(reader: SaxReader, options: SaxOptions | undefined = undefined) {
    this.reader_ = reader;
    // Avoid capturing information that will be ignored
    if (this.reader_.processingInstruction != null) {
      this.flags_ |= Flags.CAPTURE_PI;
    }
    if (this.reader_.comment != null) {
      this.flags_ |= Flags.CAPTURE_COMMENT;
    }
    if (options?.incompleteTextNodes) {
      this.flags_ |= Flags.OPT_INCOMPLETE_TEXT_NODES;
    }
    const dtd = options?.dtd;
    if (dtd === "ignore") {
      this.flags_ |= Flags.IGNORE_INT_SUBSET_DECL;
    } else if (dtd === "prohibit") {
      this.flags_ |= Flags.PROHIBIT_DOCTYPE_DECL;
    }
    this.maxNameLength_ = options?.maxNameLength ?? 2_000;
    this.maxAttributes_ = options?.maxAttributes ?? 2_000;
    this.maxTextLength_ = options?.maxTextLength ?? 10_000_000;
    this.maxEntityLength_ = options?.maxEntityLength ?? 1_000_000;
    this.maxEntityDepth_ = options?.maxEntityDepth ?? 10;
    this.entityProvider_ = options?.entityProvider ?? undefined;
  }

  /**
   * Add more data for the parser to process. May be called repeatedly to parse
   * a streaming source.
   *
   * Input string must be well-formed (have no lone surrogates) as most common
   * XML sources (`fetch`, `TextDecoder`) already verify this is the case.
   * Note however that a string coming from other source may not be guaranteed
   * to be well-formed. Use `isWellFormed` to check if you are unsure.
   *
   * @param input
   * @throws {@link SaxError}
   * @since 1.0.0
   */
  write(input: string) {
    this.chunk_ += input;
    // Ensure CRLF is handled correctly across chunk boundary
    const cr = this.chunk_.charCodeAt(this.chunk_.length - 1) === Chars.CR;
    if (cr) {
      this.chunk_ = this.chunk_.slice(0, -1);
    }
    while (this.index_ < this.chunk_.length) {
      this.parseStep_();
    }
    this.offset_ += this.chunk_.length;
    this.chunk_ = cr ? "\r" : "";
    this.index_ = 0;
  }

  /**
   * Signal to the parser that the source has ended.
   * @throws {@link SaxError}
   * @since 1.0.0
   */
  end() {
    if (this.state_ === State.INIT) {
      // Document is less than 6 characters long.
      this.state_ = State.MISC;
      this.write(this.element_);
    }
    if (
      this.elements_.length !== 0 ||
      this.state_ !== State.MISC ||
      !(this.flags_ & Flags.SEEN_ROOT)
    ) {
      throw new SaxError("UnexpectedEof");
    }
  }

  // Strings are assumed to be well-formed, meaning they do not contain any
  // lone surrogates code units.
  // @internal
  private parseStep_() {
    switch (this.state_) {
      case State.INIT:
        return this.parseInit_();
      case State.XML_DECL:
        return this.parseXmlDecl_();
      // case State.XML_DECL_SPACE:
      //   return this.parseXmlDeclSpace_();
      // case State.XML_DECL_VALUE:
      //   return this.parseXmlDeclValue_();
      // case State.XML_DECL_VALUE_QUOTED:
      //   return this.parseXmlDeclValueQuoted_();
      // case State.XML_DECL_END:
      //   return this.parseXmlDeclEnd_();
      case State.DOCTYPE_DECL_START:
        return this.parseDoctypeDeclStart_();
      case State.DOCTYPE_DECL:
        return this.parseDoctypeDecl_();
      case State.DOCTYPE_NAME:
        return this.parseDoctypeName_();
      case State.DOCTYPE_NAME_END:
        return this.parseDoctypeNameEnd_();
      case State.EXTERNAL_ID:
        return this.parseDoctypeExternalId_();
      case State.EXTERNAL_ID_SYSTEM_SPACE:
        return this.parseDoctypeSystemSpace_();
      case State.EXTERNAL_ID_QUOTED_START:
        return this.parseDoctypeExternalIdQuotedStart_();
      case State.EXTERNAL_ID_QUOTED:
        return this.parseDoctypeExternalIdQuoted_();
      case State.DOCTYPE_MAYBE_INTERNAL_SUBSET:
        return this.parseDoctypeMaybeInternalSubset_();
      case State.INTERNAL_SUBSET:
        return this.parseInternalSubset_();
      case State.INTERNAL_SUBSET_PE_REF_START:
        return this.parseInternalSubsetPeRefStart_();
      case State.INTERNAL_SUBSET_PE_REF:
        return this.parseInternalSubsetPeRef_();
      case State.INTERNAL_SUBSET_OPEN_ANGLE:
        return this.parseInternalSubsetOpenAngle_();
      case State.INTERNAL_SUBSET_OPEN_ANGLE_BANG:
        return this.parseInternalSubsetOpenAngleBang_();
      case State.INTERNAL_SUBSET_DECL:
        return this.parseInternalSubsetDecl_();
      case State.INTERNAL_SUBSET_DECL_QUOTED:
        return this.parseInternalSubsetDeclQuoted_();
      case State.DOCTYPE_END:
        return this.parseDoctypeEnd_();
      case State.MISC:
        return this.parseMisc_();
      case State.PI_TARGET_START:
        return this.parsePiTargetStart_();
      case State.PI_TARGET:
        return this.parsePiTarget_();
      case State.PI_CONTENT_START:
        return this.parsePiContentStart_();
      case State.PI_CONTENT:
        return this.parsePiContent_();
      case State.PI_CONTENT_END:
        return this.parsePiContentEnd_();
      case State.PI_END:
        return this.parsePiEnd_();
      case State.COMMENT_START:
        return this.parseCommentStart_();
      case State.COMMENT:
        return this.parseComment_();
      case State.COMMENT_HYPHEN:
        return this.parseCommentHyphen_();
      case State.COMMENT_END:
        return this.parseCommentEnd_();
      case State.OPEN_ANGLE_BRACKET:
        return this.parseOpenAngleBracket_();
      case State.OPEN_ANGLE_BRACKET_BANG:
        return this.parseOpenAngleBracketBang_();
      case State.START_TAG_NAME:
        return this.parseStartTagName_();
      case State.START_TAG:
        return this.parseStartTag_();
      case State.START_TAG_SPACE:
        return this.parseStartTagSpace_();
      case State.START_TAG_ATTR:
        return this.parseStartTagAttr_();
      case State.START_TAG_ATTR_EQ:
        return this.parseStartTagAttrEq_();
      case State.START_TAG_ATTR_VALUE:
        return this.parseStartTagAttrValue_();
      case State.START_TAG_ATTR_VALUE_QUOTED:
        return this.parseStartTagAttrValueQuoted_();
      case State.EMPTY_TAG:
        return this.parseEmptyTag_();
      case State.TEXT_CONTENT:
        return this.parseTextContent_();
      // &amp; &#38; general entity reference or character reference
      case State.REFERENCE:
        return this.parseReference_();
      case State.ENTITY_REF:
        return this.parseEntityRef_();
      case State.CHAR_REF:
        return this.parseCharRef_();
      // &#38;
      case State.CHAR_REF_DEC:
        return this.parseCharRefDec_();
      // &#x26;
      case State.CHAR_REF_HEX:
        return this.parseCharRefHex_();
      case State.CDATA_SECTION_START:
        return this.parseCdataSectionStart_();
      case State.CDATA_SECTION:
        return this.parseCdataSection_();
      case State.CDATA_SECTION_END0:
        return this.parseCdataSectionEnd0_();
      case State.CDATA_SECTION_END:
        return this.parseCdataSectionEnd_();
      case State.END_TAG_START:
        return this.parseEndTagStart_();
      case State.END_TAG:
        return this.parseEndTag_();
      case State.END_TAG_END:
        return this.parseEndTagEnd_();
    }
  }

  // XMLDecl and doctypedecl are optimized for size and not for speed since they
  // are only read once. DTD is only skimmed through as fast as possible for now

  // @internal
  private parseInit_() {
    const newChunk = this.chunk_.slice(0, 6 - this.element_.length);
    this.element_ += newChunk;
    this.index_ += newChunk.length;
    // XMLDecl is "<?xml" SPACE, not checking for space could false positive on
    // a PI with a name that happens to start with xml.
    if (
      this.element_.length === 6 &&
      this.element_.slice(0, -1) === "<?xml" &&
      isWhiteSpace(this.element_.charCodeAt(5))
    ) {
      this.state_ = State.XML_DECL;
    } else if (this.element_.length === 6) {
      this.chunk_ = this.element_ + this.chunk_.slice(newChunk.length);
      this.index_ = 0;
      this.state_ = State.MISC;
      this.element_ = "";
    }
  }

  // @internal
  private parseXmlDecl_() {
    if (this.element_.charCodeAt(this.element_.length - 1) === Chars.QUESTION) {
      // Edge case, last chunk ended in ? so this chunk must start with >
      this.element_ += this.chunk_.charAt(this.index_);
      ++this.index_;
    } else {
      // Fast path: jump to the end of the XML Decl, we only search for ?
      // because we know the character after that is either a > or the document
      // is not well-formed.
      const question = this.chunk_.indexOf("?", this.index_);
      const end = question === -1 ? this.chunk_.length : question + 2;
      const chunk = this.chunk_.slice(this.index_, end);
      if (this.element_.length + (end - this.index_) > 2000) {
        throw new SaxError("LimitExceeded");
      }
      this.element_ += chunk;
      this.index_ = end;
      // XML Decl did not end in this chunk.
      if (question === -1 || end > this.chunk_.length) {
        return;
      }
    }
    const xmlDecl = parseXmlDecl(this.element_);
    // this.version_ = xmlDecl.version;
    // this.encoding_ = xmlDecl.encoding;
    this.standalone_ = xmlDecl.standalone;
    this.reader_.xml?.(xmlDecl);
    this.state_ = State.MISC;
    this.element_ = "";
  }

  // @internal
  private parseDoctypeDeclStart_() {
    // No need to backtrack here, we know it's either DOCTYPE or fatal error
    const start = this.index_;
    this.index_ += 7 - this.element_.length;
    this.element_ += this.chunk_.slice(start, this.index_);
    this.index_ += 7 - this.element_.length;
    if (
      this.element_.slice(0, 6) === "OCTYPE" &&
      isWhiteSpace(this.element_.charCodeAt(6))
    ) {
      if (this.flags_ & Flags.PROHIBIT_DOCTYPE_DECL) {
        throw new SaxError("InvalidDoctypeDecl");
      }
      this.flags_ |= Flags.SEEN_DOCTYPE;
      this.state_ = State.DOCTYPE_DECL;
      this.element_ = "";
    } else if (this.element_.length === 7) {
      throw new SaxError("InvalidCData");
    }
  }

  // @internal
  private parseDoctypeDecl_() {
    if (!this.skipWhiteSpace_()) {
      return;
    }
    const char = this.nextCodePoint_();
    if (!isNameStartChar(char)) {
      throw new SaxError("InvalidDoctypeDecl");
    }
    this.element_ = String.fromCodePoint(char);
    this.state_ = State.DOCTYPE_NAME;
  }

  // @internal
  private parseDoctypeName_() {
    this.element_ += this.readNameCharacters_(this.element_.length);
    if (this.index_ < this.chunk_.length) {
      this.state_ = State.DOCTYPE_NAME_END;
      this.parseDoctypeNameEnd_();
    }
  }

  // @internal
  private getNameAndExternalId_() {
    const systemId = this.flags_ & Flags.EXTERNAL_ID_SYSTEM
      ? normalizeLineEndings(this.content_)
      : undefined;
    const publicId = this.flags_ & Flags.EXTERNAL_ID_PUBLIC
      // [..] all strings of white space in the public identifier MUST be
      // normalized to single space characters (#x20), and leading and trailing
      // white space MUST be removed
      // TAB is not allowed in public identifiers
      ? this.attribute_
        .replace(/^[\n\r ]*|[\n\r ]*$|[\n\r ]+/g, " ")
        .slice(1, -1)
      : undefined;
    this.content_ = "";
    this.attribute_ = "";
    this.flags_ &= ~(Flags.EXTERNAL_ID_PUBLIC | Flags.EXTERNAL_ID_SYSTEM);
    // [11] SystemLiteral	::= ('"' [^"]* '"') | ("'" [^']* "'")
    // [12] PubidLiteral ::= '"' PubidChar* '"' | "'" (PubidChar - "'")* "'
    // [13] PubidChar	::= #x20 | #xD | #xA | [a-zA-Z0-9] | [-'()+,./:=?;!*#@$_%]
    // SystemLiteral is constrained by the Char production
    // PubidLiteral has further constraints imposed by PubidChar
    if (
      (systemId !== undefined && hasInvalidChar(systemId)) ||
      (publicId !== undefined &&
        /[^ a-zA-Z0-9-'()+,./:=?;!*#@$_%]/.test(publicId))
    ) {
      return undefined;
    }
    return {name: this.element_, publicId, systemId};
  }

  // @internal
  private doctypeEnd_() {
    ++this.index_;
    const doctype = this.getNameAndExternalId_();
    if (doctype === undefined) {
      throw new SaxError("InvalidDoctypeDecl");
    }
    this.reader_.doctype?.(doctype);
    this.element_ = "";
    this.state_ = State.MISC;
  }

  // @internal
  private parseDoctypeNameEnd_() {
    if (!this.skipWhiteSpace_()) {
      return;
    }
    const codeUnit = this.chunk_.charCodeAt(this.index_);
    if (codeUnit === Chars.GT) {
      this.doctypeEnd_();
      return;
    }
    if (codeUnit === Chars.OPEN_BRACKET) {
      this.doctypeEnd_();
      this.state_ = State.INTERNAL_SUBSET;
    } else {
      this.state_ = State.EXTERNAL_ID;
    }
  }

  // @internal
  private parseDoctypeExternalId_() {
    const newChunk = this.chunk_.slice(
      this.index_,
      this.index_ + 7 - this.content_.length,
    );
    this.index_ += newChunk.length;
    this.content_ += newChunk;
    const externalId = this.content_.slice(0, 6);
    const isS = isWhiteSpace(this.content_.charCodeAt(6));
    if (externalId === "PUBLIC" && isS) {
      this.flags_ |= Flags.EXTERNAL_ID_PUBLIC;
      this.flags_ |= Flags.EXTERNAL_ID_SYSTEM;
      this.otherState_ = State.EXTERNAL_ID_SYSTEM_SPACE;
      this.state_ = State.EXTERNAL_ID_QUOTED_START;
      this.content_ = "";
    } else if (externalId === "SYSTEM" && isS) {
      this.flags_ |= Flags.EXTERNAL_ID_SYSTEM;
      this.otherState_ = State.DOCTYPE_MAYBE_INTERNAL_SUBSET;
      this.state_ = State.EXTERNAL_ID_QUOTED_START;
      this.content_ = "";
    } else if (this.content_.length === 7) {
      throw new SaxError("InvalidDoctypeDecl");
    }
  }

  // @internal
  private parseDoctypeSystemSpace_() {
    this.attribute_ = this.content_;
    this.content_ = "";
    if (!isWhiteSpace(this.chunk_.charCodeAt(this.index_))) {
      throw new SaxError("InvalidDoctypeDecl");
    }
    ++this.index_;
    this.otherState_ = State.DOCTYPE_MAYBE_INTERNAL_SUBSET;
    this.state_ = State.EXTERNAL_ID_QUOTED_START;
  }

  // @internal
  private parseDoctypeExternalIdQuotedStart_() {
    if (!this.skipWhiteSpace_()) {
      return;
    }
    const codeUnit = this.chunk_.charCodeAt(this.index_);
    ++this.index_;
    if (codeUnit !== Chars.QUOTE && codeUnit !== Chars.APOSTROPHE) {
      throw new SaxError("InvalidDoctypeDecl");
    }
    this.state_ = State.EXTERNAL_ID_QUOTED;
    this.quote_ = codeUnit;
  }

  // @internal
  private parseDoctypeExternalIdQuoted_() {
    const index = this.chunk_.indexOf(
      this.quote_ === Chars.APOSTROPHE ? "'" : '"',
      this.index_,
    );
    const chunk = this.chunk_.slice(
      this.index_,
      index === -1 ? undefined : index,
    );
    if (this.content_.length + chunk.length > this.maxNameLength_) {
      throw new SaxError("LimitExceeded");
    }
    this.content_ += chunk;
    if (index === -1) {
      this.index_ = this.chunk_.length;
    } else {
      this.index_ = index + 1;
      this.state_ = this.otherState_;
      this.otherState_ = 0;
    }
  }

  // @internal
  private parseDoctypeMaybeInternalSubset_() {
    if (!this.skipWhiteSpace_()) {
      return;
    }
    const codeUnit = this.chunk_.charCodeAt(this.index_);
    if (codeUnit === Chars.OPEN_BRACKET || codeUnit === Chars.GT) {
      this.doctypeEnd_();
      if (codeUnit === Chars.OPEN_BRACKET) {
        this.state_ = State.INTERNAL_SUBSET;
      }
    } else {
      throw new SaxError("InvalidDoctypeDecl");
    }
  }

  // @internal
  private parseInternalSubset_() {
    loop: while (this.index_ < this.chunk_.length) {
      const codeUnit = this.chunk_.charCodeAt(this.index_);
      ++this.index_;
      switch (codeUnit) {
        case Chars.PERCENT:
          this.state_ = State.INTERNAL_SUBSET_PE_REF_START;
          break loop;
        case Chars.LT:
          this.state_ = State.INTERNAL_SUBSET_OPEN_ANGLE;
          break loop;
        case Chars.CLOSE_BRACKET:
          this.state_ = State.DOCTYPE_END;
          break loop;
        default:
          if (!isWhiteSpace(codeUnit)) {
            throw new SaxError("InvalidDoctypeDecl");
          }
      }
    }
  }

  // @internal
  private parseInternalSubsetPeRefStart_() {
    const codePoint = this.nextCodePoint_();
    if (!isNameStartChar(codePoint)) {
      throw new SaxError("InvalidInternalSubset");
    }
    this.textLength_ = 0;
    this.state_ = State.INTERNAL_SUBSET_PE_REF;
  }

  // @internal
  private parseInternalSubsetPeRef_() {
    // PE references are not expanded but the name is still collected.
    this.element_ += this.readNameCharacters_(this.element_.length);
    if (this.index_ >= this.chunk_.length) {
      return;
    }
    this.checkNCName_(this.element_);
    this.element_ = "";
    if (this.chunk_.charCodeAt(this.index_) !== Chars.SEMICOLON) {
      throw new SaxError("InvalidInternalSubset");
    }
    ++this.index_;
    this.state_ = State.INTERNAL_SUBSET;
    if (!this.standalone_) {
      this.flags_ |= Flags.IGNORE_INT_SUBSET_DECL;
    }
  }

  // @internal
  private parseInternalSubsetOpenAngle_() {
    const codeUnit = this.chunk_.charCodeAt(this.index_);
    ++this.index_;
    if (codeUnit === Chars.BANG) {
      this.state_ = State.INTERNAL_SUBSET_OPEN_ANGLE_BANG;
    } else if (codeUnit === Chars.QUESTION) {
      this.otherState_ = State.INTERNAL_SUBSET;
      this.state_ = State.PI_TARGET_START;
    } else {
      throw new SaxError("InvalidInternalSubset");
    }
  }

  // @internal
  private parseInternalSubsetOpenAngleBang_() {
    const codeUnit = this.chunk_.charCodeAt(this.index_);
    if (codeUnit === Chars.HYPHEN) {
      ++this.index_;
      this.otherState_ = State.INTERNAL_SUBSET;
      this.state_ = State.COMMENT_START;
    } else {
      this.state_ = State.INTERNAL_SUBSET_DECL;
    }
  }

  // @internal
  protected readName_() {
    if (!isNameStartChar(this.chunk_.codePointAt(this.index_)!)) {
      throw new SaxError("InvalidInternalSubset");
    }
    return this.readNameCharacters_(0);
  }
  // Allow namespace parser to override this
  // @internal
  protected checkNCName_(name: string) {
    void name;
  }
  // @internal
  private readExternalId_(isNotation: boolean) {
    const matches = this.chunk_.slice(this.index_).match(
      EXTERNAL_OR_PUBLIC_ID_RE,
    );
    if (matches == null || !isNotation && matches[4] === undefined) {
      throw new SaxError("InvalidInternalSubset");
    }
    this.index_ += matches[0].length;
  }

  // @internal
  private readEntityValue_() {
    let start = this.index_;
    while (this.index_ < this.chunk_.length) {
      const codeUnit = this.chunk_.charCodeAt(this.index_);
      switch (codeUnit) {
        case Chars.TAB:
        case Chars.LF:
          break;
        case Chars.CR:
          this.appendContent_(start, this.maxEntityLength_);
          this.content_ += "\n";
          if (this.chunk_.charCodeAt(this.index_ + 1) === Chars.LF) {
            ++this.index_;
          }
          start = this.index_ + 1;
          break;
        case this.quote_:
          this.appendContent_(start, this.maxEntityLength_);
          return;
        case Chars.AMPERSAND:
          if (this.chunk_.charCodeAt(this.index_ + 1) === Chars.HASH) {
            this.appendContent_(start, this.maxEntityLength_);
            this.index_ += 2;
            this.otherState_ = this.state_;
            this.parseCharRef_();
            this.parseStep_();
            start = this.index_;
            --this.index_;
          } else {
            ++this.index_;
            // Entities must not be expanded but must parse correctly.
            this.checkNCName_(this.readName_());
            if (this.chunk_.charCodeAt(this.index_) !== Chars.SEMICOLON) {
              throw new SaxError("InvalidInternalSubset");
            }
          }
          break;
        case Chars.PERCENT:
          throw new SaxError("InvalidInternalSubset");
        default:
          // Other characters still need to be validated:
          if (codeUnit < 0x20 || codeUnit > 0xfffd) {
            throw new SaxError("InvalidChar");
          }
      }
      ++this.index_;
    }
    // this.appendContent_(start, this.maxEntityLength_);
  }

  // @internal
  private readEntityDecl_() {
    this.index_ += 7;
    this.skipWhiteSpace_();
    const isParameter = this.chunk_.charCodeAt(this.index_) === Chars.PERCENT;
    if (isParameter) {
      ++this.index_;
      this.skipWhiteSpace_();
    }
    const entityName = this.readName_();
    this.checkNCName_(entityName);
    if (!isWhiteSpace(this.chunk_.charCodeAt(this.index_))) {
      throw new SaxError("InvalidInternalSubset");
    }
    this.skipWhiteSpace_();
    let decl: string | EntityDecl;
    const quote = this.chunk_.charCodeAt(this.index_);
    if (quote === Chars.APOSTROPHE || quote === Chars.QUOTE) {
      ++this.index_;
      this.quote_ = quote;
      this.readEntityValue_();
      // This is not possible because of the internal subset is collects entire
      // quoted strings.
      // if (this.chunk_.charCodeAt(this.index_) !== quote) {
      //   throw new SaxError("InvalidInternalSubset");
      // }
      ++this.index_;
      decl = this.content_;
      this.content_ = "";
    } else {
      decl = EntityDecl.EXTERNAL;
      this.readExternalId_(/* isNotation */ false);
      this.state_ = State.INTERNAL_SUBSET;
      if (!isParameter && isWhiteSpace(this.chunk_.charCodeAt(this.index_))) {
        this.skipWhiteSpace_();
        if (
          this.chunk_.slice(this.index_, this.index_ + 5) === "NDATA" &&
          isWhiteSpace(this.chunk_.charCodeAt(this.index_ + 5))
        ) {
          this.index_ += 6;
          this.skipWhiteSpace_();
          this.checkNCName_(this.readName_());
          decl = EntityDecl.UNPARSED;
        }
      }
    }
    this.skipWhiteSpace_();
    if (this.chunk_.charCodeAt(this.index_) !== Chars.GT) {
      throw new SaxError("InvalidInternalSubset");
    }
    if (
      !(this.flags_ & Flags.IGNORE_INT_SUBSET_DECL) &&
      !isParameter &&
      !this.entities_.has(entityName)
    ) {
      this.entities_.set(entityName, decl);
    }
  }

  // @internal
  private readNotationOrEnumeration_(isNotation: boolean) {
    this.skipWhiteSpace_();
    if (this.chunk_.charCodeAt(this.index_) !== Chars.OPEN_PAREN) {
      throw new SaxError("InvalidInternalSubset");
    }
    ++this.index_;
    while (true) {
      this.skipWhiteSpace_();
      if (isNotation) {
        this.checkNCName_(this.readName_());
      } else if (this.readNameCharacters_(0).length === 0) {
        throw new SaxError("InvalidInternalSubset");
      }
      this.skipWhiteSpace_();
      const codeUnit = this.chunk_.charCodeAt(this.index_);
      ++this.index_;
      if (codeUnit === Chars.CLOSE_PAREN) {
        break;
      } else if (codeUnit !== Chars.VERTICAL_BAR) {
        throw new SaxError("InvalidInternalSubset");
      }
    }
  }

  // @internal
  private readAttlistDecl_() {
    this.index_ += 8;
    this.skipWhiteSpace_();
    const element = this.readName_();
    let attlist = this.attlists_.get(element);
    if (attlist === undefined) {
      attlist = new Map();
      this.attlists_.set(element, attlist);
    }
    while (true) {
      const codeUnit = this.chunk_.charCodeAt(this.index_);
      if (!isWhiteSpace(codeUnit) && codeUnit !== Chars.GT) {
        throw new SaxError("InvalidInternalSubset");
      }
      this.skipWhiteSpace_();
      if (this.chunk_.charCodeAt(this.index_) === Chars.GT) {
        break;
      }
      const attribute = this.readName_();
      if (!isWhiteSpace(this.chunk_.charCodeAt(this.index_))) {
        throw new SaxError("InvalidInternalSubset");
      }
      this.skipWhiteSpace_();
      let isTokenized = true;
      if (this.chunk_.charCodeAt(this.index_) !== Chars.OPEN_PAREN) {
        const start = this.index_;
        while (
          this.index_ < this.chunk_.length &&
          !isWhiteSpace(this.chunk_.charCodeAt(this.index_))
        ) {
          ++this.index_;
        }
        const attType = this.chunk_.slice(start, this.index_);
        if (attType === "CDATA") {
          isTokenized = false;
        } else if (attType === "NOTATION") {
          this.readNotationOrEnumeration_(/* isNotation */ true);
        } else if (ATT_TYPES.indexOf(attType) === -1) {
          throw new SaxError("InvalidInternalSubset");
        }
      } else {
        this.readNotationOrEnumeration_(/* isNotation */ false);
      }
      if (!isWhiteSpace(this.chunk_.charCodeAt(this.index_))) {
        throw new SaxError("InvalidInternalSubset");
      }
      this.skipWhiteSpace_();
      let hasDefault = true;
      const hash = this.chunk_.charCodeAt(this.index_);
      if (hash === Chars.HASH) {
        const start = this.index_;
        let codeUnit;
        while (
          !isWhiteSpace(codeUnit = this.chunk_.charCodeAt(this.index_)) &&
          codeUnit !== Chars.GT
        ) {
          ++this.index_;
        }
        const defaultDecl = this.chunk_.slice(start, this.index_);
        if (ATT_DEFAULT_DECLS.indexOf(defaultDecl) === -1) {
          throw new SaxError("InvalidInternalSubset");
        }
        if (defaultDecl !== "#FIXED") {
          hasDefault = false;
        }
      }
      let defaultValue;
      if (hasDefault) {
        this.skipWhiteSpace_();
        const quote = this.chunk_.charCodeAt(this.index_);
        if (quote === Chars.APOSTROPHE || quote === Chars.QUOTE) {
          ++this.index_;
          const quoteIndex = this.chunk_.indexOf(
            quote === Chars.APOSTROPHE ? "'" : '"',
            this.index_,
          );
          const chunk = this.chunk_;
          this.chunk_ = this.chunk_.slice(this.index_, quoteIndex);
          this.index_ = 0;
          this.state_ = State.START_TAG_ATTR_VALUE_QUOTED;
          while (this.index_ < this.chunk_.length) {
            this.parseStep_();
          }
          this.index_ = quoteIndex + 1;
          this.chunk_ = chunk;
          this.state_ = State.INTERNAL_SUBSET;
          defaultValue = this.content_;
          this.content_ = "";
        } else {
          throw new SaxError("InvalidInternalSubset");
        }
        if (isTokenized) {
          defaultValue = normalizeAttributeValue(defaultValue);
        }
      }
      if (
        !(this.flags_ & Flags.IGNORE_INT_SUBSET_DECL) &&
        !attlist.has(attribute)
      ) {
        attlist.set(attribute, {
          default_: defaultValue,
          isTokenized_: isTokenized,
        });
      }
    }
    this.skipWhiteSpace_();
  }

  // @internal
  private readNotationDecl_() {
    this.index_ += 9;
    this.skipWhiteSpace_();
    this.checkNCName_(this.readName_());
    // Not necessary readExternalId_ will throw anyway
    // if (!isWhiteSpace(this.chunk_.charCodeAt(this.index_))) {
    //   throw new SaxError("InvalidInternalSubset");
    // }
    this.skipWhiteSpace_();
    this.readExternalId_(/* isNotation */ true);
    this.skipWhiteSpace_();
    if (this.chunk_.charCodeAt(this.index_) !== Chars.GT) {
      throw new SaxError("InvalidInternalSubset");
    }
  }

  // @internal
  private readChoiceOrSeq_() {
    this.skipWhiteSpace_();
    this.readCp_(false);
    this.skipWhiteSpace_();
    const sep = this.chunk_.charCodeAt(this.index_);
    if (sep !== Chars.VERTICAL_BAR && sep !== Chars.COMMA) {
      if (sep === Chars.CLOSE_PAREN) {
        ++this.index_;
      }
      return;
    }
    while (this.chunk_.charCodeAt(this.index_) === sep) {
      ++this.index_;

      this.skipWhiteSpace_();
      this.readCp_(false);
      this.skipWhiteSpace_();
    }
    if (this.chunk_.charCodeAt(this.index_) === Chars.CLOSE_PAREN) {
      ++this.index_;
    }
  }

  // @internal
  private readCp_(isChildren: boolean) {
    if (
      isChildren ||
      this.chunk_.charCodeAt(this.index_) === Chars.OPEN_PAREN
    ) {
      if (!isChildren) {
        ++this.index_;
      }
      // choice or seq
      this.readChoiceOrSeq_();
    } else {
      this.readName_();
    }
    const codeUnit = this.chunk_.charCodeAt(this.index_);
    if (
      codeUnit === Chars.QUESTION ||
      codeUnit === Chars.ASTERISK ||
      codeUnit === Chars.PLUS
    ) {
      ++this.index_;
    }
  }

  // @internal
  private readElementDecl_() {
    this.index_ += 8;
    this.skipWhiteSpace_();
    this.readName_();
    if (!isWhiteSpace(this.chunk_.charCodeAt(this.index_))) {
      throw new SaxError("InvalidInternalSubset");
    }
    this.skipWhiteSpace_();
    if (this.chunk_.charCodeAt(this.index_) === Chars.OPEN_PAREN) {
      ++this.index_;
      this.skipWhiteSpace_();
      // Mixed
      if (this.chunk_.slice(this.index_, this.index_ + 7) === "#PCDATA") {
        this.index_ += 7;
        while (this.index_ < this.chunk_.length) {
          this.skipWhiteSpace_();
          const codeUnit = this.chunk_.charCodeAt(this.index_);
          ++this.index_;
          if (codeUnit === Chars.CLOSE_PAREN) {
            break;
          }
          if (codeUnit !== Chars.VERTICAL_BAR) {
            throw new SaxError("InvalidInternalSubset");
          }
          this.skipWhiteSpace_();
          this.readName_();
        }
        if (this.chunk_.charCodeAt(this.index_) === Chars.ASTERISK) {
          ++this.index_;
        }
      } else {
        this.readCp_(true);
      }
      this.skipWhiteSpace_();
    } else if (this.chunk_.slice(this.index_, this.index_ + 5) === "EMPTY") {
      this.index_ += 5;
      this.skipWhiteSpace_();
    } else if (this.chunk_.slice(this.index_, this.index_ + 3) === "ANY") {
      this.index_ += 3;
      this.skipWhiteSpace_();
    }
    if (this.chunk_.charCodeAt(this.index_) !== Chars.GT) {
      throw new SaxError("InvalidInternalSubset");
    }
  }

  // @internal
  private readInternalSubsetDecl_() {
    const index = this.index_;
    const chunk = this.chunk_;
    this.index_ = 0;
    this.chunk_ = this.content_;
    this.content_ = "";
    if (
      this.chunk_.slice(0, 6) === "ENTITY" &&
      isWhiteSpace(this.chunk_.charCodeAt(6))
    ) {
      this.readEntityDecl_();
    } else if (
      this.chunk_.slice(0, 7) === "ATTLIST" &&
      isWhiteSpace(this.chunk_.charCodeAt(7))
    ) {
      this.readAttlistDecl_();
    } else if (
      this.chunk_.slice(0, 8) === "NOTATION" &&
      isWhiteSpace(this.chunk_.charCodeAt(8))
    ) {
      this.readNotationDecl_();
    } else if (
      this.chunk_.slice(0, 7) === "ELEMENT" &&
      isWhiteSpace(this.chunk_.charCodeAt(7))
    ) {
      this.readElementDecl_();
    } else {
      throw new SaxError("InvalidInternalSubset");
    }
    this.index_ = index;
    this.chunk_ = chunk;
  }

  // @internal
  private parseInternalSubsetDecl_() {
    const start = this.index_;
    loop: while (this.index_ < this.chunk_.length) {
      const codeUnit = this.chunk_.charCodeAt(this.index_);
      ++this.index_;
      switch (codeUnit) {
        case Chars.APOSTROPHE:
        case Chars.QUOTE:
          this.quote_ = codeUnit;
          this.state_ = State.INTERNAL_SUBSET_DECL_QUOTED;
          break loop;
        case Chars.GT:
          this.state_ = State.INTERNAL_SUBSET;
          break loop;
      }
    }
    this.appendContent_(start, this.maxTextLength_);
    if (this.state_ === State.INTERNAL_SUBSET) {
      this.readInternalSubsetDecl_();
    }
  }

  // @internal
  private parseInternalSubsetDeclQuoted_() {
    const index = this.chunk_.indexOf(
      this.quote_ === Chars.APOSTROPHE ? "'" : '"',
      this.index_,
    );
    const start = this.index_;
    if (index !== -1) {
      this.index_ = index + 1;
      this.state_ = State.INTERNAL_SUBSET_DECL;
      this.quote_ = -1;
    } else {
      this.index_ = this.chunk_.length;
    }
    this.appendContent_(start, this.maxTextLength_);
  }

  // @internal
  private parseDoctypeEnd_() {
    if (!this.skipWhiteSpace_()) {
      return;
    }
    if (this.chunk_.charCodeAt(this.index_) !== Chars.GT) {
      throw new SaxError("InvalidDoctypeDecl");
    }
    ++this.index_;
    this.state_ = State.MISC;
  }

  // @internal
  private parseMisc_() {
    if (!this.skipWhiteSpace_()) {
      return;
    }
    if (this.chunk_.charCodeAt(this.index_) === Chars.LT) {
      ++this.index_;
      this.state_ = State.OPEN_ANGLE_BRACKET;
      this.otherState_ = State.MISC;
    } else {
      throw new SaxError("InvalidCData");
    }
  }

  // @internal
  private parsePiTargetStart_() {
    // codePointAt is fine here since we are not in a loop
    const codePoint = this.nextCodePoint_();
    if (isNameStartChar(codePoint)) {
      this.state_ = State.PI_TARGET;
      this.element_ = String.fromCodePoint(codePoint);
    } else {
      throw new SaxError("InvalidPI");
    }
  }

  // @internal
  private parsePiTarget_() {
    this.element_ += this.readNameCharacters_(this.element_.length);
    if (this.index_ < this.chunk_.length) {
      // Name read to completion
      this.checkNCName_(this.element_);
      if (this.element_.length === 3 && this.element_.toLowerCase() === "xml") {
        throw new SaxError("ReservedPI");
      }
      const codeUnit = this.chunk_.charCodeAt(this.index_);
      ++this.index_;
      if (isWhiteSpace(codeUnit)) {
        this.state_ = State.PI_CONTENT_START;
      } else if (codeUnit === Chars.QUESTION) {
        this.state_ = State.PI_END;
      } else {
        throw new SaxError("InvalidPI");
      }
    }
  }

  // @internal
  private parsePiContentStart_() {
    if (this.skipWhiteSpace_()) {
      this.state_ = State.PI_CONTENT;
    }
  }

  // @internal
  private piEnd_() {
    if (this.flags_ & Flags.CAPTURE_PI) {
      this.reader_.processingInstruction?.(this.element_, this.content_);
    }
    this.element_ = "";
    this.content_ = "";
    this.state_ = this.otherState_;
    this.otherState_ = 0;
  }

  // @internal
  private parsePiContent_() {
    // All the searching is done with indexOf, basically a native strstr routine
    // which is much faster than anything that can be written manually in JS.
    const index = this.chunk_.indexOf("?>", this.index_);
    const content = this.chunk_.slice(
      this.index_,
      index === -1 ? undefined : index,
    );
    if (hasInvalidChar(content)) {
      throw new SaxError("InvalidChar");
    }
    if (this.flags_ & Flags.CAPTURE_PI) {
      const actualContent = normalizeLineEndings(content);
      if (this.content_.length + actualContent.length > this.maxTextLength_) {
        throw new SaxError("LimitExceeded");
      }
      this.content_ += actualContent;
    }
    if (index === -1) {
      this.index_ = this.chunk_.length;
      if (this.chunk_.charCodeAt(this.chunk_.length - 1) === Chars.QUESTION) {
        this.state_ = State.PI_CONTENT_END;
      }
    } else {
      this.index_ = index + 2;
      this.piEnd_();
    }
  }

  // @internal
  private parsePiContentEnd_() {
    if (this.chunk_.charCodeAt(this.index_) === Chars.GT) {
      this.content_ = this.content_.slice(0, -1);
      ++this.index_;
      this.piEnd_();
    } else {
      this.state_ = State.PI_CONTENT;
      this.parsePiContent_();
    }
  }

  // @internal
  private parsePiEnd_() {
    if (this.chunk_.charCodeAt(this.index_) === Chars.GT) {
      ++this.index_;
      this.piEnd_();
    } else {
      throw new SaxError("InvalidPI");
    }
  }

  // @internal
  private parseCommentStart_() {
    if (this.chunk_.charCodeAt(this.index_) !== Chars.HYPHEN) {
      throw new SaxError("InvalidCData");
    }
    ++this.index_;
    this.state_ = State.COMMENT;
  }

  // @internal
  private parseComment_() {
    // Same rationale behind parsePi_
    const index = this.chunk_.indexOf("--", this.index_);
    const content = this.chunk_.slice(
      this.index_,
      index === -1 ? undefined : index,
    );
    if (hasInvalidChar(content)) {
      throw new SaxError("InvalidChar");
    }
    if (this.flags_ & Flags.CAPTURE_COMMENT) {
      const actualContent = normalizeLineEndings(content);
      if (this.content_.length + actualContent.length > this.maxTextLength_) {
        throw new SaxError("LimitExceeded");
      }
      this.content_ += actualContent;
    }
    if (index === -1) {
      // Chunk is read to completion even on an ending hyphen, it will be
      // removed after the fact if the comment is ending.
      this.index_ = this.chunk_.length;
      // This chunk doesn't contain the end of this comment but it may contain
      // a trailing hyphen that has to be handled on the next chunk.
      if (this.chunk_.charCodeAt(this.chunk_.length - 1) === Chars.HYPHEN) {
        this.state_ = State.COMMENT_HYPHEN;
      }
    } else {
      this.index_ = index + 2;
      this.state_ = State.COMMENT_END;
    }
  }

  // @internal
  private parseCommentHyphen_() {
    if (this.chunk_.charCodeAt(this.index_) === Chars.HYPHEN) {
      // Content still contains the hyphen from the previous chunk.
      this.content_ = this.content_.slice(0, -1);
      ++this.index_;
      this.state_ = State.COMMENT_END;
    } else {
      this.state_ = State.COMMENT;
      // Handle the rest of the chunk without incurring in the overhead of a
      // next iteration in the main loop.
      this.parseComment_();
    }
  }

  // @internal
  private parseCommentEnd_() {
    if (this.chunk_.charCodeAt(this.index_) === Chars.GT) {
      ++this.index_;
      if (this.flags_ & Flags.CAPTURE_COMMENT) {
        this.reader_.comment?.(this.content_);
      }
      this.content_ = "";
      this.state_ = this.otherState_;
      this.otherState_ = 0;
    } else {
      throw new SaxError("InvalidComment");
    }
  }

  // @internal
  private parseOpenAngleBracket_() {
    const codePoint = this.nextCodePoint_();
    if (isNameStartChar(codePoint)) {
      this.element_ = String.fromCodePoint(codePoint);
      // Cannot have two root elements
      if (
        this.elements_.length === 0 &&
        this.entityStack_.length === 0 &&
        this.flags_ & Flags.SEEN_ROOT
      ) {
        throw new SaxError("InvalidStartTag");
      }
      this.flags_ |= Flags.SEEN_ROOT;
      this.state_ = State.START_TAG_NAME;
    } else if (codePoint === Chars.SLASH) {
      this.state_ = State.END_TAG_START;
    } else if (codePoint === Chars.BANG) {
      this.state_ = State.OPEN_ANGLE_BRACKET_BANG;
    } else if (codePoint === Chars.QUESTION) {
      this.state_ = State.PI_TARGET_START;
    } else {
      throw new SaxError("InvalidStartTag");
    }
  }

  // @internal
  private parseOpenAngleBracketBang_() {
    const codeUnit = this.chunk_.charCodeAt(this.index_);
    ++this.index_;
    if (codeUnit === Chars.HYPHEN) {
      this.state_ = State.COMMENT_START;
    } else if (
      codeUnit === Chars.OPEN_BRACKET &&
      (this.elements_.length !== 0 || this.entityStack_.length !== 0)
    ) {
      this.state_ = State.CDATA_SECTION_START;
    } else if (codeUnit === 0x44 /* D */) {
      if (this.flags_ & Flags.SEEN_DOCTYPE || this.flags_ & Flags.SEEN_ROOT) {
        throw new SaxError("InvalidDoctypeDecl");
      }
      this.state_ = State.DOCTYPE_DECL_START;
    } else {
      throw new SaxError("InvalidCData");
    }
  }

  // @internal
  private setDefaultAttributes_() {
    const attlist = this.attlists_.get(this.element_);
    if (attlist === undefined) {
      return;
    }
    for (const [attribute, {default_}] of attlist) {
      if (default_ !== undefined && !this.attributes_.has(attribute)) {
        if (this.attributes_.size >= this.maxAttributes_) {
          throw new SaxError("LimitExceeded");
        }
        this.attributes_.set(attribute, default_);
      }
    }
  }

  // @internal
  private startTagEnd_() {
    this.setDefaultAttributes_();
    this.state_ = State.TEXT_CONTENT;
    this.otherState_ = 0;
    this.reader_.startTag(this.element_, this.attributes_);
    this.elements_.push(this.element_);
    this.element_ = "";
    this.attributes_.clear();
  }

  // @internal
  private parseStartTagName_() {
    this.element_ += this.readNameCharacters_(this.element_.length);
    if (this.index_ < this.chunk_.length) {
      const codeUnit = this.chunk_.charCodeAt(this.index_);
      ++this.index_;
      if (codeUnit === Chars.GT) {
        this.startTagEnd_();
      } else if (isWhiteSpace(codeUnit)) {
        this.state_ = State.START_TAG;
      } else if (codeUnit === Chars.SLASH) {
        this.state_ = State.EMPTY_TAG;
      } else {
        throw new SaxError("InvalidStartTag");
      }
    }
  }

  // @internal
  private parseStartTag_() {
    if (!this.skipWhiteSpace_()) {
      return;
    }
    const codePoint = this.nextCodePoint_();
    if (isNameStartChar(codePoint)) {
      this.state_ = State.START_TAG_ATTR;
      this.attribute_ = String.fromCodePoint(codePoint);
    } else if (codePoint === Chars.GT) {
      this.startTagEnd_();
    } else if (codePoint === Chars.SLASH) {
      this.state_ = State.EMPTY_TAG;
    } else {
      throw new SaxError("InvalidStartTag");
    }
  }

  // @internal
  private parseStartTagSpace_() {
    const codeUnit = this.chunk_.charCodeAt(this.index_)!;
    ++this.index_;
    if (codeUnit === Chars.GT) {
      this.startTagEnd_();
    } else if (isWhiteSpace(codeUnit)) {
      this.state_ = State.START_TAG;
      this.parseStartTag_();
    } else if (codeUnit === Chars.SLASH) {
      this.state_ = State.EMPTY_TAG;
    } else {
      throw new SaxError("InvalidStartTag");
    }
  }

  // @internal
  private parseStartTagAttr_() {
    this.attribute_ += this.readNameCharacters_(this.attribute_.length);
    if (this.index_ < this.chunk_.length) {
      const codeUnit = this.chunk_.charCodeAt(this.index_);
      ++this.index_;
      if (codeUnit === Chars.EQ) {
        // Most likely case
        this.state_ = State.START_TAG_ATTR_VALUE;
      } else if (isWhiteSpace(codeUnit)) {
        this.state_ = State.START_TAG_ATTR_EQ;
      } else {
        throw new SaxError("InvalidStartTag");
      }
    }
  }

  // @internal
  private parseStartTagAttrEq_() {
    if (!this.skipWhiteSpace_()) {
      return;
    }
    if (this.chunk_.charCodeAt(this.index_) === Chars.EQ) {
      ++this.index_;
      this.state_ = State.START_TAG_ATTR_VALUE;
    } else {
      throw new SaxError("InvalidStartTag");
    }
  }

  // @internal
  private parseStartTagAttrValue_() {
    if (!this.skipWhiteSpace_()) {
      return;
    }
    const codeUnit = this.chunk_.charCodeAt(this.index_);
    switch (codeUnit) {
      case Chars.APOSTROPHE:
      case Chars.QUOTE:
        this.quote_ = codeUnit;
        ++this.index_;
        this.state_ = State.START_TAG_ATTR_VALUE_QUOTED;
        break;
      default:
        throw new SaxError("InvalidStartTag");
    }
  }

  // @internal
  private parseStartTagAttrValueQuoted_() {
    const quote = this.quote_;
    let start = this.index_;
    loop: while (this.index_ < this.chunk_.length) {
      const codeUnit = this.chunk_.charCodeAt(this.index_);
      switch (codeUnit) {
        case Chars.TAB:
        case Chars.LF:
        case Chars.CR:
          this.appendContent_(start, this.maxTextLength_ - 1);
          this.content_ += " ";
          if (
            this.entityStack_.length === 0 &&
            codeUnit === Chars.CR &&
            this.chunk_.charCodeAt(this.index_ + 1) === Chars.LF
          ) {
            ++this.index_;
          }
          start = this.index_ + 1;
          break;
        case Chars.AMPERSAND:
          // TODO: this should be recursive for non-predefined general entity
          // references...
          this.state_ = State.REFERENCE;
          this.otherState_ = State.START_TAG_ATTR_VALUE_QUOTED;
          break loop;
        case quote: {
          this.appendContent_(start, this.maxTextLength_);
          ++this.index_;
          this.state_ = State.START_TAG_SPACE;
          if (this.attributes_.has(this.attribute_)) {
            throw new SaxError("AttributeRedefined", {
              attribute: this.attribute_,
            });
          }
          const attlists = this.attlists_.get(this.element_);
          const attlist = attlists !== undefined
            ? attlists.get(this.attribute_)
            : undefined;
          const value = attlist !== undefined && attlist.isTokenized_
            ? normalizeAttributeValue(this.content_)
            : this.content_;
          if (this.attributes_.size >= this.maxAttributes_) {
            throw new SaxError("LimitExceeded");
          }
          this.attributes_.set(this.attribute_, value);
          this.attribute_ = "";
          this.content_ = "";
          return;
        }
        case Chars.LT:
          // < is not allowed inside attribute values
          throw new SaxError("InvalidAttributeValue");
        default:
          // Other characters still need to be validated:
          if (codeUnit < 0x20 || codeUnit > 0xfffd) {
            throw new SaxError("InvalidChar");
          }
      }
      ++this.index_;
    }
    this.appendContent_(start, this.maxTextLength_);
    ++this.index_;
  }

  // @internal
  private parseEmptyTag_() {
    if (this.chunk_.charCodeAt(this.index_) === Chars.GT) {
      ++this.index_;
      this.setDefaultAttributes_();
      // Empty tag could still be the root element
      this.state_ =
        this.elements_.length === 0 && this.entityStack_.length === 0
          ? State.MISC
          : State.TEXT_CONTENT;
      this.otherState_ = 0;
      this.reader_.emptyTag(this.element_, this.attributes_);
      this.element_ = "";
      this.attributes_.clear();
    } else {
      throw new SaxError("InvalidStartTag");
    }
  }

  // @internal
  private appendTextContent_(start: number) {
    const chunk = this.chunk_.slice(start, this.index_);
    this.textLength_ += chunk.length;
    if (this.textLength_ >= this.maxTextLength_) {
      throw new SaxError("LimitExceeded");
    }
    this.content_ += chunk;
  }

  // This should ideally be somewhere else so that it can be applied to entities
  // This is the hottest part of the parser as most of an XML Document is text
  // content.
  // @internal
  private parseTextContent_() {
    let start = this.index_;
    // Due to having multiple exit points and error conditions, text content
    // can't be parsed using indexOf + regex validation.
    loop: while (this.index_ < this.chunk_.length) {
      const codeUnit = this.chunk_.charCodeAt(this.index_);
      switch (codeUnit) {
        case Chars.TAB:
        case Chars.LF:
          // TAB and LF are valid and since they are common, it's faster to
          // handle them here than in the default case
          // TODO: add significant white space handler?
          break;
        case Chars.CR:
          if (this.entityStack_.length === 0) {
            // Carriage return requires new-line normalization
            this.appendTextContent_(start);
            this.content_ += "\n";
            if (this.chunk_.charCodeAt(this.index_ + 1) === Chars.LF) {
              ++this.index_;
            }
            start = this.index_ + 1;
          }
          break;
        // State changing conditions:
        case Chars.AMPERSAND:
          // It was considered to handle references inline but they are not
          // common enough to justify doing more work here
          this.state_ = State.REFERENCE;
          this.otherState_ = State.TEXT_CONTENT;
          break loop;
        case Chars.LT:
          this.textLength_ = 0;
          this.state_ = State.OPEN_ANGLE_BRACKET;
          this.otherState_ = State.TEXT_CONTENT;
          break loop;
        case Chars.GT:
          // Catch ]]>, this.otherState_ just stores the number of consecutive
          // brackets found.
          if (this.otherState_ > 1) {
            throw new SaxError("InvalidCDEnd");
          }
          break;
        default:
          // Other characters still need to be validated:
          if (codeUnit < 0x20 || codeUnit > 0xfffd) {
            throw new SaxError("InvalidChar");
          }
      }
      if (codeUnit === Chars.CLOSE_BRACKET) {
        ++this.otherState_;
      } else {
        this.otherState_ = 0;
      }
      ++this.index_;
    }
    // By the time we get here, the chunk is finished or a special character was
    // reached.
    this.appendTextContent_(start);
    // Emit text content as needed
    if (
      this.state_ !== State.TEXT_CONTENT ||
      this.flags_ & Flags.OPT_INCOMPLETE_TEXT_NODES
    ) {
      this.reader_.text(this.content_, false);
      this.content_ = "";
    }
    ++this.index_;
  }

  // @internal
  private parseReference_() {
    const codePoint = this.nextCodePoint_();
    if (isNameStartChar(codePoint)) {
      this.entity_ = String.fromCodePoint(codePoint);
      this.state_ = State.ENTITY_REF;
    } else if (codePoint === Chars.HASH) {
      this.state_ = State.CHAR_REF;
    } else {
      throw new SaxError("InvalidEntityRef");
    }
  }
  // @internal
  private parseEntityRef_() {
    this.entity_ += this.readNameCharacters_(this.entity_.length);
    if (this.index_ >= this.chunk_.length) {
      return;
    }
    this.checkNCName_(this.entity_);
    if (this.chunk_.charCodeAt(this.index_) !== Chars.SEMICOLON) {
      throw new SaxError("InvalidEntityRef");
    }
    ++this.index_;
    if (PREDEFINED_ENTITIES.hasOwnProperty(this.entity_)) {
      this.content_ +=
        PREDEFINED_ENTITIES[this.entity_ as keyof typeof PREDEFINED_ENTITIES];
    } else {
      // WFC: No Recursion
      if (this.entityStack_.indexOf(this.entity_) !== -1) {
        throw new SaxError("RecursiveEntity", {
          entity: this.entity_,
        });
      }

      // const isAttValue = this.otherState_ ===
      //   State.START_TAG_ATTR_VALUE_QUOTED;
      let entityValue = this.entities_.get(this.entity_);
      // Unparsed entities cannot be referenced anywhere.
      // WFC: Parsed Entity
      if (entityValue === EntityDecl.UNPARSED) {
        throw new SaxError("UnparsedEntity", {entity: this.entity_});
      }
      // Attribute values
      // WFC: No External Entity References
      if (
        this.otherState_ === State.START_TAG_ATTR_VALUE_QUOTED &&
        entityValue === EntityDecl.EXTERNAL
      ) {
        throw new SaxError("ExternalEntity", {entity: this.entity_});
      }
      // Allow the application to set a default value for an entity not
      // declared in internal markup declarations.
      if (entityValue === EntityDecl.EXTERNAL || entityValue === undefined) {
        entityValue = this.entityProvider_?.getEntity(this.entity_);
      }
      if (entityValue == null) {
        if (
          // WFC: Entity Declared
          // [..] [For] non-validating processors [..], the rule that an entity
          // must be declared is a well-formedness constraint only if
          // standalone="yes"
          this.standalone_ ||
          // It is an error if an attribute value contains a reference to an
          // entity for which no declaration has been read
          // This is not a fatal error but recovering from here is too
          // complicated and not generally useful (an application can still
          // just return any value from getGeneralEntity to suppress the error)
          this.otherState_ === State.START_TAG_ATTR_VALUE_QUOTED ||
          // Allow the application to handle undeclared entities in content.
          !this.reader_.entityRef?.(this.entity_)
        ) {
          throw new SaxError("UndeclaredEntity", {
            entity: this.entity_,
          });
        }
      } else {
        this.entityLength_ += entityValue.length;
        if (
          this.entityLength_ > this.maxEntityLength_ ||
          this.entityStack_.length >= this.maxEntityDepth_
        ) {
          throw new SaxError("LimitExceeded");
        }
        this.entityStack_.push(this.entity_);
        const index = this.index_;
        const chunk = this.chunk_;
        const quote = this.quote_;
        const elements = this.elements_;
        const otherState = this.otherState_;

        this.index_ = 0;
        this.chunk_ = "" + entityValue;
        this.quote_ = -1;
        this.elements_ = [];
        this.state_ = this.otherState_;
        this.otherState_ = 0;
        this.entity_ = "";

        while (this.index_ < this.chunk_.length) {
          this.parseStep_();
        }

        // https://www.w3.org/TR/REC-xml/#intern-replacement
        // [...] references MUST be contained entirely within the literal entity
        // value.
        // TODO: error handling
        // if (isAttValue && this.state_ !== State.START_TAG_ATTR_VALUE_QUOTED) {
        //   throw this.createSaxError_("INVALID_ATTRIBUTE_VALUE");
        // }
        // Entity value must match content production
        if (this.elements_.length !== 0 || this.state_ !== otherState) {
          throw new SaxError("UnexpectedEof");
        }

        this.entityStack_.pop();
        if (this.entityStack_.length === 0) {
          this.entityLength_ = 0;
        }
        this.index_ = index;
        this.chunk_ = chunk;
        this.quote_ = quote;
        this.elements_ = elements;
        this.otherState_ = this.state_;
      }
    }
    this.state_ = this.otherState_;
    this.otherState_ = 0;
    this.entity_ = "";
  }

  // @internal
  private parseCharRef_() {
    if (this.chunk_.charCodeAt(this.index_) === Chars.LOWER_X) {
      ++this.index_;
      this.state_ = State.CHAR_REF_HEX;
    } else {
      this.state_ = State.CHAR_REF_DEC;
    }
  }

  // @internal
  private handleCharRef_() {
    // Skip semicolon ;
    ++this.index_;
    // TODO: 0 is not allowed so both explicit zero &#0; and zero size number
    //  &#; end up throwing here, but there's no way to know which one it is now
    if (!isChar(this.charRef_)) {
      throw new SaxError("InvalidCharRef");
    }
    this.content_ += String.fromCodePoint(this.charRef_);
    this.charRef_ = 0;
    this.state_ = this.otherState_;
    this.otherState_ = 0;
  }

  // @internal
  private parseCharRefDec_() {
    while (this.index_ < this.chunk_.length) {
      const codeUnit = this.chunk_.charCodeAt(this.index_);
      if (codeUnit === Chars.SEMICOLON) {
        this.handleCharRef_();
        break;
      }
      const digit = (codeUnit - 0x30) >>> 0;
      if (digit > 9) {
        throw new SaxError("InvalidCharRef");
      }
      this.charRef_ = this.charRef_ * 10 + digit;
      ++this.index_;
    }
  }

  // @internal
  private parseCharRefHex_() {
    while (this.index_ < this.chunk_.length) {
      const codeUnit = this.chunk_.charCodeAt(this.index_);
      if (codeUnit === Chars.SEMICOLON) {
        this.handleCharRef_();
        break;
      }
      let digit = (codeUnit - 0x30) >>> 0;
      if (digit > 9) {
        digit = ((codeUnit | 0x20) - 0x57) >>> 0;
        if (digit < 10 || digit > 15) {
          throw new SaxError("InvalidCharRef");
        }
      }
      this.charRef_ = this.charRef_ * 16 + digit;
      ++this.index_;
    }
  }

  // @internal
  private parseCdataSectionStart_() {
    const start = this.index_;
    this.index_ += 6 - this.element_.length;
    this.element_ += this.chunk_.slice(start, this.index_);
    if (this.element_ === "CDATA[") {
      this.state_ = State.CDATA_SECTION;
      this.element_ = "";
    } else if (this.element_.length === 6) {
      throw new SaxError("InvalidCData");
    }
  }

  // @internal
  private parseCdataSection_() {
    // Same rationale behind parsePi_
    const index = this.chunk_.indexOf("]]>", this.index_);
    const content = this.chunk_.slice(
      this.index_,
      index === -1 ? undefined : index,
    );
    if (hasInvalidChar(content)) {
      throw new SaxError("InvalidChar");
    }
    const chunk = normalizeLineEndings(content);
    this.textLength_ += chunk.length;
    if (this.textLength_ >= this.maxTextLength_) {
      throw new SaxError("LimitExceeded");
    }
    this.content_ += chunk;
    if (index === -1) {
      // Chunk is read to completion even on an ending close bracket, it just
      // removed from content and state is set appropriately.
      this.index_ = this.chunk_.length;
      if (
        this.chunk_.charCodeAt(this.chunk_.length - 1) === Chars.CLOSE_BRACKET
      ) {
        if (
          this.chunk_.charCodeAt(this.chunk_.length - 2) === Chars.CLOSE_BRACKET
        ) {
          this.state_ = State.CDATA_SECTION_END;
          this.content_ = this.content_.slice(0, -2);
        } else {
          this.state_ = State.CDATA_SECTION_END0;
          this.content_ = this.content_.slice(0, -1);
        }
      }
      if (this.flags_ & Flags.OPT_INCOMPLETE_TEXT_NODES) {
        this.reader_.text(this.content_, true);
        this.content_ = "";
      }
    } else {
      this.index_ = index + 2;
      this.state_ = State.CDATA_SECTION_END;
    }
  }

  // @internal
  private parseCdataSectionEnd0_() {
    if (this.chunk_.charCodeAt(this.index_) === Chars.CLOSE_BRACKET) {
      ++this.index_;
      this.state_ = State.CDATA_SECTION_END;
    } else {
      this.content_ += "]";
      this.state_ = State.CDATA_SECTION;
    }
  }

  // @internal
  private parseCdataSectionEnd_() {
    const codeUnit = this.chunk_.charCodeAt(this.index_);
    if (codeUnit === Chars.GT) {
      ++this.index_;
      this.reader_.text(this.content_, true);
      this.state_ = State.TEXT_CONTENT;
      this.otherState_ = 0;
      this.content_ = "";
      this.textLength_ = 0;
    } else if (codeUnit === Chars.CLOSE_BRACKET) {
      ++this.index_;
      this.textLength_ += 1;
      if (this.textLength_ > this.maxTextLength_) {
        throw new SaxError("LimitExceeded");
      }
      this.content_ += "]";
    } else {
      // ]] was already included in content before
      this.content_ += "]]";
      this.state_ = State.CDATA_SECTION;
    }
  }

  // @internal
  private parseEndTagStart_() {
    const codePoint = this.nextCodePoint_();
    if (isNameStartChar(codePoint)) {
      this.state_ = State.END_TAG;
      this.element_ = String.fromCodePoint(codePoint);
      this.parseEndTag_();
    } else {
      throw new SaxError("InvalidEndTag");
    }
  }

  // @internal
  private parseEndTag_() {
    this.element_ += this.readNameCharacters_(this.element_.length);
    if (this.index_ < this.chunk_.length) {
      this.state_ = State.END_TAG_END;
      this.parseEndTagEnd_();
    }
  }

  // @internal
  private parseEndTagEnd_() {
    if (!this.skipWhiteSpace_()) {
      return;
    }
    const codeUnit = this.chunk_.charCodeAt(this.index_);
    if (codeUnit !== Chars.GT) {
      throw new SaxError("InvalidEndTag");
    }
    if (this.elements_.pop() !== this.element_) {
      throw new SaxError("TagNameMismatch", {
        element: this.element_,
      });
    }
    ++this.index_;
    this.state_ = this.elements_.length === 0 && this.entityStack_.length === 0
      ? State.MISC
      : State.TEXT_CONTENT;
    this.otherState_ = 0;
    this.reader_.endTag(this.element_);
    this.element_ = "";
  }

  // Internal functions

  // @internal
  private appendContent_(start: number, limit: number) {
    const chunk = this.chunk_.slice(start, this.index_);
    if (this.content_.length + chunk.length > limit) {
      throw new SaxError("LimitExceeded");
    }
    this.content_ += chunk;
  }

  // @internal
  private nextCodePoint_() {
    let codePoint = this.chunk_.charCodeAt(this.index_);
    if (codePoint >= 0xd800 && codePoint <= 0xdbff) {
      // https://unicode.org/faq/utf_bom.html#utf16-3
      codePoint = (codePoint << 10) + this.chunk_.charCodeAt(++this.index_) -
        0x35fdc00;
    }
    ++this.index_;
    return codePoint;
  }

  // @internal
  private readNameCharacters_(length: number) {
    const start = this.index_;
    while (this.index_ < this.chunk_.length) {
      const codeUnit = this.chunk_.charCodeAt(this.index_)!;
      if (!isNameChar(codeUnit)) {
        // codeUnit now is either an invalid code point or a leading surrogate
        // of a valid or invalid code point.
        // Trick: only limitation on astral code points is they have to be less
        // than or equal to U+EFFFF, since we assume all strings are well-formed
        // UTF-16, surrogates are known to be valid.
        // Leading surrogate value is the only significant value to determine
        // that the code point is in range -- restricted to 0x3BF (most
        // significant 11 bits of 0xEFFFF) plus leading surrogate offset 0xD7C0.
        // For our assumptions the following code unit is known to be a trailing
        // surrogate character with the lower 10 bits of the code point which
        // are irrelevant for the range check.
        if (codeUnit >= 0xd800 && codeUnit <= 0xdb7f) {
          // codeUnit is the leading surrogate of a valid astral code point
          ++this.index_;
        } else {
          // codeUnit is an invalid code point or the leading surrogate of an
          // invalid astral code point
          break;
        }
      }
      ++this.index_;
    }
    const name = this.chunk_.slice(start, this.index_);
    if (length + name.length > this.maxNameLength_) {
      throw new SaxError("LimitExceeded");
    }
    return name;
  }

  // @internal
  private skipWhiteSpace_() {
    while (this.index_ < this.chunk_.length) {
      if (!isWhiteSpace(this.chunk_.charCodeAt(this.index_))) {
        break;
      }
      ++this.index_;
    }
    return this.index_ !== this.chunk_.length;
  }
}

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
   * - If `prefix` is not found, the return value is {@linkcode SaxNamespaceReader.lookupNamespace}
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

export interface SaxNamespaceReader extends BaseReader {
  /**
   * Start tag.
   *
   * ```xml
   * <element attr="value">
   * ```
   * @param name - Name of the element.
   * @param attributes - Attributes of the tag. Only valid for the
   * duration of this call, implementors should make a copy to persist
   * attributes.
   */
  startTag(
    name: QName,
    attributes: NamespaceAttributes,
    resolver: NamespaceResolver,
  ): void;
  /**
   * An empty tag.
   *
   * ```xml
   * <element attr="value" />
   * ```
   * @param name - Name of the element.
   * @param attributes - Attributes of the tag. Only valid for the
   * duration of this call, implementors should make a copy to persist
   * attributes.
   */
  emptyTag(
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
   */
  endTag(name: QName, resolver: NamespaceResolver): void;
  entityRef?(entityName: string, resolver: NamespaceResolver): boolean;
  text(
    content: string,
    isCdataSection: boolean,
    resolver: NamespaceResolver,
  ): void;
}

// @internal
interface AttributeNs extends QName {
  value: string;
}

// @internal
function getQName(attribute: AttributeNs): QName {
  return {
    name: attribute.name,
    localName: attribute.localName,
    prefix: attribute.prefix,
    namespace: attribute.namespace,
  };
}

// @internal
class NamespaceAttributes_ implements NamespaceAttributes {
  // @internal
  private map_ = new Map<string, AttributeNs>();
  // @internal
  clear_() {
    this.map_.clear();
  }
  // @internal
  add_(attribute: AttributeNs) {
    const key = attribute.namespace !== undefined
      ? `${attribute.namespace}:${attribute.localName}`
      : attribute.localName;
    this.map_.set(key, attribute);
  }
  // @internal
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

// @internal
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

// @internal
class NamespaceResolver_ implements SaxReader, NamespaceResolver {
  // prefix -> namespace URI
  // @internal
  private namespaces_ = new Map<string, string>([
    ["xml", XML_NAMESPACE],
    ["xmlns", XMLNS_NAMESPACE],
  ]);
  // Depth number -> [prefix, shadowed ns or empty string, ...]
  // The root element is depth 1
  // @internal
  private prefixBindings_ = new Map<number, string[]>();
  // Reused across calls
  // @internal
  private attributes_ = new NamespaceAttributes_();
  // Required for faithful lookupPrefix
  // @internal
  private elementPrefixes_: string[] = [];
  // @internal
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
  // @internal
  processingInstruction?(target: string, content: string) {
    return this.reader_.processingInstruction!(target, content);
  }
  // @internal
  comment?(text: string) {
    return this.reader_.comment!(text);
  }
  // @internal
  entityRef?(entityName: string) {
    return !!this.reader_.entityRef?.(entityName, this);
  }
  // @internal
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
  // @internal
  private handleAttributes_(attributes: Attributes): NamespaceAttributes {
    this.attributes_.clear_();
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
      this.attributes_.add_(attribute);
    }
    return this.attributes_;
  }
  // @internal
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
    const attributesNs = this.handleAttributes_(attributes);
    const qName = this.parseQName_(name, false);
    this.elementPrefixes_.push(qName.prefix ?? "");
    this.reader_.startTag(qName, attributesNs, this);
  }
  emptyTag(name: string, attributes: Attributes) {
    const attributesNs = this.handleAttributes_(attributes);
    const qName = this.parseQName_(name, false);
    this.elementPrefixes_.push(qName.prefix ?? "");
    this.reader_.emptyTag(qName, attributesNs, this);
    this.popPrefixes_();
  }
  endTag(name: string) {
    this.reader_.endTag(this.parseQName_(name, false), this);
    this.popPrefixes_();
  }
  text(content: string, isCdataSection: boolean) {
    return this.reader_.text(content, isCdataSection, this);
  }
}

export interface SaxNamespaceOptions extends SaxOptions {
}

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
  // @internal
  protected override readName_(): string {
    const name = super.readName_();
    checkQName(name);
    return name;
  }
  // @internal
  protected override checkNCName_(name: string): void {
    if (name.indexOf(":") !== -1) {
      throw new SaxError("InvalidNCName");
    }
  }
}
