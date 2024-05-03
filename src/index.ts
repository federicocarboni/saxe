/** */

import {
  Chars,
  hasInvalidChar,
  isChar,
  isNameChar,
  isNameStartChar,
  isWhiteSpace,
} from "./chars.ts";
import {createSaxError} from "./error.ts";
import {MAX_ENTITY_LENGTH} from "./limits.ts";

export {isSaxError, type SaxError, type SaxErrorCode} from "./error.ts";

/**
 * XML Declaration (XMLDecl).
 *
 * ```xml
 * <?xml version="1.0" encoding="UTF-8" standalone="no" ?>
 * ```
 * @since 1.0.0
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
   * @since 1.0.0
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
   * @since 1.0.0
   */
  standalone?: boolean | undefined;
}

/**
 * Document type declaration.
 *
 * ```xml
 * <!DOCTYPE example PUBLIC "-//Example//example doc" "http://example.org/example.dtd">
 * ```
 * @since 1.0.0
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
 * https://www.w3.org/TR/REC-xml/
 * @since 1.0.0
 */
export interface SaxReader {
  /**
   * XML Declaration of the document.
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
  pi?(target: string, content: string): void;
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
  /**
   * Return the replacement text of an external entity or an entity declared in
   * external markup declarations. For unparsed entities, or entities for which
   * the application has no declarations `undefined` should be returned.
   * @param entityName -
   */
  getGeneralEntity?(entityName: string): string | undefined;
  /**
   * A general entity reference.
   *
   * ```xml
   * <root>
   * &entity;
   * </root>
   * ```
   * @param entityName -
   */
  entityRef?(entityName: string): void;
  /**
   * Start tag.
   *
   * ```xml
   * <element attr="value">
   * ```
   * @param name -
   * @param attributes -
   */
  start(name: string, attributes: ReadonlyMap<string, string>): void;
  /**
   * An empty tag.
   *
   * ```xml
   * <element attr="value" />
   * ```
   * @param name -
   * @param attributes -
   */
  empty(name: string, attributes: ReadonlyMap<string, string>): void;
  /**
   * An end tag.
   *
   * ```xml
   * </element>
   * ```
   * @param name -
   */
  end(name: string): void;
  /**
   * Text and character data of the document.
   *
   * ```xml
   * <element>text &amp; content</element>
   * ```
   *
   * The above example produces a `text` event with `text & content`.
   *
   * By default text is collected as if to form a DOM Text Node (CDATA sections
   * are treated as part of text nodes), to reduce memory usage but produce more
   * `text` events for the same text node enable `incompleteTextNodes`.
   *
   * Entity references which are not predefined (i.e. not `amp`, `lt`, `gt`,
   * `apos` or `quot`) are handled by `entityRef`.
   * @param text -
   */
  text(text: string): void;
}

/**
 * @since 1.0.0
 */
export interface SaxOptions {
  /**
   * Enable passing incomplete text nodes to the `text` handler. By default the
   * parser collects text segments as if it were to form a DOM Text Node even if
   * they are split in multiple chunks. This means the parser's output is always
   * predictable even when chunks are unevenly sized. This option makes it so
   * the parser emits `text` every time a chunk is received, reducing memory
   * usage for large text nodes but making the parser's `text` calls potentially
   * erratic.
   *
   * E.g. if the parser receives the following chunks:
   *
   * ```xml
   * <element>some content
   * ```
   *
   * ```xml
   * some other content</element>
   * ```
   *
   * For `incompleteTextNodes: false`, the parser will call `text` once with
   * `some content some other content`.
   *
   * For `incompleteTextNodes: true`, the parser will instead call `text` twice,
   * once with `some content` and the next with `some other content`.
   *
   * The same concept is also applied to CDATA sections because they are
   * considered just part of document text.
   *
   * **Note**: while this can speed up documents with large chunks of text that
   * will be ignored it can have a negative impact on documents with many short
   * text nodes.
   * @default false
   */
  incompleteTextNodes?: boolean | undefined;
  /**
   * To protect against malicious input this can be used to cap the number of
   * code units which can be produced while expanding an entity. If it is not
   * specified or set to `undefined` entity expansion is essentially uncapped.
   *
   * It is recommended to set this to a sensible value when handling potentially
   * malicious input.
   * @default 1_000_000
   */
  maxEntityLength?: number | undefined;
  /**
   * @default "default"
   */
  internalSubset?: "default" | "ignore" | undefined;
}

const enum State {
  INIT,
  XML_DECL,
  XML_DECL_SPACE,
  XML_DECL_VALUE,
  XML_DECL_VALUE_QUOTED,
  XML_DECL_END,
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

// A bit of an abuse of const enum but needed to ensure perf
const enum Flags {
  INIT = 0,

  // Option flags, these are turned on or off depending on SaxReader and
  // SaxOptions and do not change as more input is read.

  // Capture Processing Instructions or ignore them.
  CAPTURE_PI = 1 << 0,
  // Capture Comments or ignore them.
  CAPTURE_COMMENT = 1 << 1,
  _RESERVED = 1 << 2,
  // These are boolean properties in SaxOptions
  OPT_INCOMPLETE_TEXT_NODES = 1 << 3,
  // OPT_TEXT_ONLY_ENTITIES = 1 << 4,

  // Runtime flags:
  SEEN_DOCTYPE = 1 << 4,
  SEEN_ROOT = 1 << 5,
  DOCTYPE_PUBLIC = 1 << 6,
  DOCTYPE_SYSTEM = 1 << 7,
  IGNORE_INT_SUBSET_DECL = 1 << 8,
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
  "CDATA",
  "ID",
  "IDREF",
  "IDREFS",
  "ENTITY",
  "ENTITIES",
  "NMTOKEN",
  "NMTOKENS",
  "NOTATION",
];

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

  // Options
  // @internal
  private maxEntityLength_: number;

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
  private flags_ = Flags.INIT;
  // @internal
  private entityLength_ = 0;
  // @internal
  private charRef_ = 0;
  // @internal
  private quote_ = -1;

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
  // @internal
  private version_: string | undefined = undefined;
  // @internal
  private encoding_: string | undefined = undefined;
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
    if (this.reader_.pi != null) {
      this.flags_ |= Flags.CAPTURE_PI;
    }
    if (this.reader_.comment != null) {
      this.flags_ |= Flags.CAPTURE_COMMENT;
    }
    if (options?.incompleteTextNodes) {
      this.flags_ |= Flags.OPT_INCOMPLETE_TEXT_NODES;
    }
    this.maxEntityLength_ = options?.maxEntityLength ?? MAX_ENTITY_LENGTH;
  }

  /**
   * Add more data for the parser to process. May be called repeatedly to parse
   * a streaming source.
   *
   * Input string must be well-formed (have no lone surrogates) as most common
   * XML sources (`fetch`, `TextDecoder`) already verify this is the case.
   * Note however that a string coming from `JSON.parse` for example is not
   * guaranteed to be well-formed. Use `isWellFormed` to check if you are
   * unsure.
   * @param input - string contents to parse
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
    this.chunk_ = cr ? "\r" : "";
    this.index_ = 0;
  }

  /**
   * Signal to the parser that the source has ended.
   * @throws {@link SaxError}
   * @since 1.0.0
   */
  end() {
    if (this.elements_.length !== 0) {
      throw createSaxError("INVALID_END_TAG");
    }
    if (this.state_ !== State.MISC || !(this.flags_ & Flags.SEEN_ROOT)) {
      throw createSaxError("UNEXPECTED_EOF");
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
      case State.XML_DECL_SPACE:
        return this.parseXmlDeclSpace_();
      case State.XML_DECL_VALUE:
        return this.parseXmlDeclValue_();
      case State.XML_DECL_VALUE_QUOTED:
        return this.parseXmlDeclValueQuoted_();
      case State.XML_DECL_END:
        return this.parseXmlDeclEnd_();
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
      this.element_.slice(0, -1) === "<?xml" &&
      isWhiteSpace(this.element_.charCodeAt(5))
    ) {
      this.state_ = State.XML_DECL;
      this.element_ = "";
    } else if (this.element_.length === 6) {
      this.chunk_ = this.element_ + this.chunk_.slice(newChunk.length);
      this.index_ = 0;
      this.state_ = State.MISC;
      this.element_ = "";
    }
  }

  // @internal
  private readXmlAttribute_() {
    const index = this.chunk_.indexOf("=", this.index_);
    let end = index;
    if (end === -1) {
      end = this.chunk_.length;
    } else {
      // Remove white space from the end
      while (isWhiteSpace(this.chunk_.charCodeAt(--end)));
      end++;
    }
    // "standalone" is the longest XMLDecl attribute, if this is longer then
    // it's not valid, catches invalid XML early and prevents using an excessive
    // amount of memory for very large values.
    if (this.attribute_.length + end - this.index_ > 10) {
      throw createSaxError("INVALID_XML_DECL");
    }
    this.attribute_ += this.chunk_.slice(this.index_, end);
    this.index_ = index === -1 ? this.chunk_.length : index + 1;
    return index !== -1;
  }

  // @internal
  private parseXmlDecl_() {
    if (this.skipWhiteSpace_()) {
      const codeUnit = this.chunk_.charCodeAt(this.index_);
      if (codeUnit === Chars.QUESTION) {
        ++this.index_;
        this.state_ = State.XML_DECL_END;
      } else if (this.readXmlAttribute_()) {
        this.state_ = State.XML_DECL_VALUE;
      }
    }
  }

  // @internal
  private parseXmlDeclSpace_() {
    const codeUnit = this.chunk_.charCodeAt(this.index_);
    if (!isWhiteSpace(codeUnit) && codeUnit !== Chars.QUESTION) {
      throw createSaxError("INVALID_XML_DECL");
    }
    this.state_ = State.XML_DECL;
    this.parseXmlDecl_();
  }

  // @internal
  private parseXmlDeclValue_() {
    if (this.skipWhiteSpace_()) {
      const codeUnit = this.chunk_.charCodeAt(this.index_);
      switch (codeUnit) {
        case Chars.APOSTROPHE:
        case Chars.QUOTE:
          this.quote_ = codeUnit;
          this.state_ = State.XML_DECL_VALUE_QUOTED;
          ++this.index_;
          break;
        default:
          throw createSaxError("INVALID_XML_DECL");
      }
    }
  }

  // @internal
  private handleXmlDeclAttribute_() {
    // Regex are slower but more compact.
    switch (this.attribute_) {
      case "version":
        if (this.version_ !== undefined || !/^1\.[0-9]$/.test(this.content_)) {
          return true;
        }
        this.version_ = this.content_;
        break;
      case "encoding":
        // XML standard doesn't define a maximum length for any construct, but
        // IANA Charsets never go above 45 characters (including aliases).
        // TODO: it's a good a idea to limit encoding labels as large values
        //  are very unlikely correct. Is 256 fine?
        if (
          this.version_ === undefined || this.encoding_ !== undefined ||
          this.standalone_ !== undefined || this.content_.length > 256 ||
          !/^[A-Za-z][A-Za-z0-9._-]*$/.test(this.content_)
        ) {
          return true;
        }
        this.encoding_ = this.content_.toLowerCase();
        break;
      case "standalone":
        if (
          this.version_ === undefined || this.standalone_ !== undefined ||
          this.content_ !== "yes" && this.content_ !== "no"
        ) {
          return true;
        }
        this.standalone_ = this.content_ === "yes";
        break;
      default:
        return true;
    }
    this.attribute_ = "";
    this.content_ = "";
    return false;
  }

  // @internal
  private parseXmlDeclValueQuoted_() {
    const index = this.chunk_.indexOf(
      this.quote_ === Chars.APOSTROPHE ? "'" : '"',
      this.index_,
    );
    const end = index === -1 ? this.chunk_.length : index;
    this.content_ += this.chunk_.slice(this.index_, end);
    this.index_ = end + 1;
    if (index !== -1) {
      this.quote_ = -1;
      if (this.handleXmlDeclAttribute_()) {
        throw createSaxError("INVALID_XML_DECL");
      }
      this.state_ = State.XML_DECL_SPACE;
    }
  }

  // @internal
  private parseXmlDeclEnd_() {
    if (
      this.chunk_.charCodeAt(this.index_) === Chars.GT &&
      this.version_ !== undefined
    ) {
      ++this.index_;
      this.state_ = State.MISC;
      this.reader_.xml?.({
        version: this.version_,
        encoding: this.encoding_,
        standalone: this.standalone_,
      });
    } else {
      throw createSaxError("INVALID_XML_DECL");
    }
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
      this.flags_ |= Flags.SEEN_DOCTYPE;
      this.state_ = State.DOCTYPE_DECL;
      this.element_ = "";
    } else if (this.element_.length === 7) {
      throw createSaxError("INVALID_CDATA");
    }
  }

  // @internal
  private parseDoctypeDecl_() {
    if (!this.skipWhiteSpace_()) {
      return;
    }
    const char = this.chunk_.codePointAt(this.index_)!;
    ++this.index_;
    if (char > 0xFFFF) {
      ++this.index_;
    }
    if (!isNameStartChar(char)) {
      throw createSaxError("INVALID_DOCTYPE_DECL");
    }
    this.element_ = String.fromCodePoint(char);
    this.state_ = State.DOCTYPE_NAME;
  }

  // @internal
  private parseDoctypeName_() {
    this.element_ += this.readNameCharacters_();
    if (this.index_ < this.chunk_.length) {
      this.state_ = State.DOCTYPE_NAME_END;
      this.parseDoctypeNameEnd_();
    }
  }

  // @internal
  private doctypeEnd_() {
    ++this.index_;
    const systemId = this.flags_ & Flags.DOCTYPE_SYSTEM
      ? normalizeLineEndings(this.content_)
      : undefined;
    const publicId = this.flags_ & Flags.DOCTYPE_PUBLIC
      // [..] all strings of white space in the public identifier MUST be
      // normalized to single space characters (#x20), and leading and trailing
      // white space MUST be removed
      // TAB is not allowed in public identifiers
      ? this.attribute_
        .replace(/^[\n\r ]*|[\n\r ]*$|[\n\r ]+/g, " ")
        .slice(1, -1)
      : undefined;
    // [11] SystemLiteral	::= ('"' [^"]* '"') | ("'" [^']* "'")
    // [12] PubidLiteral ::= '"' PubidChar* '"' | "'" (PubidChar - "'")* "'
    // [13] PubidChar	::= #x20 | #xD | #xA | [a-zA-Z0-9] | [-'()+,./:=?;!*#@$_%]
    // SystemLiteral is constrained by the Char production
    // PubidLiteral has further constraints imposed by PubidChar
    if (
      systemId !== undefined && hasInvalidChar(systemId) ||
      publicId !== undefined &&
        /[^ a-zA-Z0-9-'()+,./:=?;!*#@$_%]/.test(publicId)
    ) {
      throw createSaxError("INVALID_DOCTYPE_DECL");
    }
    this.reader_.doctype?.({name: this.element_, publicId, systemId});
    this.element_ = "";
    this.content_ = "";
    this.attribute_ = "";
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
      this.flags_ |= Flags.DOCTYPE_PUBLIC;
      this.flags_ |= Flags.DOCTYPE_SYSTEM;
      this.otherState_ = State.EXTERNAL_ID_SYSTEM_SPACE;
      this.state_ = State.EXTERNAL_ID_QUOTED_START;
      this.content_ = "";
    } else if (externalId === "SYSTEM" && isS) {
      this.flags_ |= Flags.DOCTYPE_SYSTEM;
      this.otherState_ = State.DOCTYPE_MAYBE_INTERNAL_SUBSET;
      this.state_ = State.EXTERNAL_ID_QUOTED_START;
      this.content_ = "";
    } else if (this.content_.length === 7) {
      throw createSaxError("INVALID_DOCTYPE_DECL");
    }
  }

  // @internal
  private parseDoctypeSystemSpace_() {
    this.attribute_ = this.content_;
    this.content_ = "";
    if (!isWhiteSpace(this.chunk_.charCodeAt(this.index_))) {
      throw createSaxError("INVALID_DOCTYPE_DECL");
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
      throw createSaxError("INVALID_DOCTYPE_DECL");
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
    this.content_ += this.chunk_.slice(
      this.index_,
      index === -1 ? undefined : index,
    );
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
    if (this.skipWhiteSpace_()) {
      const codeUnit = this.chunk_.charCodeAt(this.index_);
      if (codeUnit === Chars.OPEN_BRACKET || codeUnit === Chars.GT) {
        this.doctypeEnd_();
        if (codeUnit === Chars.OPEN_BRACKET) {
          this.state_ = State.INTERNAL_SUBSET;
        }
      } else {
        throw createSaxError("INVALID_DOCTYPE_DECL");
      }
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
            throw createSaxError("INVALID_DOCTYPE_DECL");
          }
      }
    }
  }

  // @internal
  private parseInternalSubsetPeRefStart_() {
    const codePoint = this.chunk_.codePointAt(this.index_)!;
    ++this.index_;
    if (codePoint > 0xFFFF) {
      ++this.index_;
    }
    if (!isNameStartChar(codePoint)) {
      throw createSaxError("INVALID_INTERNAL_SUBSET");
    }
    this.state_ = State.INTERNAL_SUBSET_PE_REF;
  }

  // @internal
  private parseInternalSubsetPeRef_() {
    this.readNameCharacters_();
    if (this.index_ >= this.chunk_.length) {
      return;
    }
    if (this.chunk_.charCodeAt(this.index_) !== Chars.SEMICOLON) {
      throw createSaxError("INVALID_INTERNAL_SUBSET");
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
      throw createSaxError("INVALID_INTERNAL_SUBSET");
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
  private readName_() {
    if (!isNameStartChar(this.chunk_.codePointAt(this.index_)!)) {
      throw createSaxError("INVALID_INTERNAL_SUBSET");
    }
    return this.readNameCharacters_();
  }

  // @internal
  private readEntityValue_() {
    let start = this.index_;
    while (this.index_ < this.chunk_.length) {
      const codeUnit = this.chunk_.charCodeAt(this.index_);
      switch (codeUnit) {
        case this.quote_:
          this.content_ += this.chunk_.slice(start, this.index_);
          return;
        case Chars.AMPERSAND:
          if (this.chunk_.charCodeAt(this.index_ + 1) === Chars.HASH) {
            this.content_ += this.chunk_.slice(start, this.index_);
            this.index_ += 2;
            this.otherState_ = this.state_;
            this.parseCharRef_();
            this.parseStep_();
            start = this.index_;
          } else {
            ++this.index_;
            // Entities must not be expanded but must parse correctly.
            this.readName_();
            if (this.chunk_.charCodeAt(this.index_) !== Chars.SEMICOLON) {
              throw createSaxError("INVALID_INTERNAL_SUBSET");
            }
          }
          break;
        case Chars.PERCENT:
          throw createSaxError("INVALID_INTERNAL_SUBSET");
        default:
          // Other characters still need to be validated:
          if (codeUnit < 0x20 || codeUnit === 0xFFFE || codeUnit === 0xFFFF) {
            throw createSaxError("INVALID_CHAR");
          }
      }
      ++this.index_;
    }
    this.content_ += this.chunk_.slice(start, this.index_);
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
    if (!isWhiteSpace(this.chunk_.charCodeAt(this.index_))) {
      throw createSaxError("INVALID_INTERNAL_SUBSET");
    }
    this.skipWhiteSpace_();
    const quote = this.chunk_.charCodeAt(this.index_);
    ++this.index_;
    if (quote === Chars.APOSTROPHE || quote === Chars.QUOTE) {
      this.quote_ = quote;
      this.readEntityValue_();
      if (this.chunk_.charCodeAt(this.index_) !== quote) {
        throw createSaxError("INVALID_INTERNAL_SUBSET");
      }
      ++this.index_;
      if (
        !(this.flags_ & Flags.IGNORE_INT_SUBSET_DECL) &&
        !isParameter && !this.entities_.has(entityName)
      ) {
        this.entities_.set(entityName, this.content_);
      }
      this.content_ = "";
    } else {
      // TODO: external entities
      this.index_ = this.chunk_.length - 1;
    }
    this.skipWhiteSpace_();
    if (this.chunk_.charCodeAt(this.index_) !== Chars.GT) {
      throw createSaxError("INVALID_INTERNAL_SUBSET");
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
        throw createSaxError("INVALID_INTERNAL_SUBSET");
      }
      this.skipWhiteSpace_();
      if (this.chunk_.charCodeAt(this.index_) === Chars.GT) {
        break;
      }
      const attribute = this.readName_();
      if (!isWhiteSpace(this.chunk_.charCodeAt(this.index_))) {
        throw createSaxError("INVALID_INTERNAL_SUBSET");
      }
      this.skipWhiteSpace_();
      let isTokenized_ = false;
      if (this.chunk_.charCodeAt(this.index_) !== Chars.OPEN_PAREN) {
        const start = this.index_;
        while (
          this.index_ < this.chunk_.length &&
          !isWhiteSpace(this.chunk_.charCodeAt(this.index_))
        ) {
          ++this.index_;
        }
        const attType = this.chunk_.slice(start, this.index_);
        if (ATT_TYPES.indexOf(attType) === -1) {
          throw createSaxError("INVALID_INTERNAL_SUBSET");
        }
        if (attType !== "CDATA") {
          isTokenized_ = true;
        }
        if (attType === "NOTATION") {
          this.skipWhiteSpace_();
          this.index_ = this.chunk_.indexOf(")", this.index_) + 1;
        }
      } else {
        this.index_ = this.chunk_.indexOf(")", this.index_) + 1;
      }
      if (!isWhiteSpace(this.chunk_.charCodeAt(this.index_))) {
        throw createSaxError("INVALID_INTERNAL_SUBSET");
      }
      this.skipWhiteSpace_();
      let canHaveDefault = true;
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
        if (
          ["#REQUIRED", "#IMPLIED", "#FIXED"]
            .indexOf(defaultDecl) === -1
        ) {
          throw createSaxError("INVALID_INTERNAL_SUBSET");
        }
        if (defaultDecl !== "#FIXED") {
          canHaveDefault = false;
        }
      }
      let default_;
      if (canHaveDefault) {
        this.skipWhiteSpace_();
        const quote = this.chunk_.charCodeAt(this.index_);
        if (quote === Chars.APOSTROPHE || quote === Chars.QUOTE) {
          ++this.index_;
          const index = this.chunk_.indexOf(
            quote === Chars.APOSTROPHE ? "'" : '"',
            this.index_,
          );
          if (index === -1) {
            throw createSaxError("INVALID_INTERNAL_SUBSET");
          }
          default_ = this.chunk_.slice(this.index_, index);
          this.index_ = index + 1;
        }
      }
      attlist.set(attribute, {default_, isTokenized_});
    }
    this.skipWhiteSpace_();
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
    this.content_ += this.chunk_.slice(start, this.index_);
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
    } else {
      this.index_ = this.chunk_.length;
    }
    this.content_ += this.chunk_.slice(start, this.index_);
  }

  // @internal
  private parseDoctypeEnd_() {
    if (!this.skipWhiteSpace_()) {
      return;
    }
    if (this.chunk_.charCodeAt(this.index_) !== Chars.GT) {
      throw createSaxError("INVALID_DOCTYPE_DECL");
    }
    ++this.index_;
    this.state_ = State.MISC;
  }

  // @internal
  private parseMisc_() {
    if (this.skipWhiteSpace_()) {
      if (this.chunk_.charCodeAt(this.index_) === Chars.LT) {
        ++this.index_;
        this.state_ = State.OPEN_ANGLE_BRACKET;
        this.otherState_ = State.MISC;
      } else {
        throw createSaxError("INVALID_CDATA");
      }
    }
  }

  // @internal
  private parsePiTargetStart_() {
    // codePointAt is fine here since we are not in a loop
    const char = this.chunk_.codePointAt(this.index_)!;
    if (isNameStartChar(char)) {
      ++this.index_;
      if (char > 0xFFFF) {
        ++this.index_;
      }
      this.state_ = State.PI_TARGET;
      this.element_ = String.fromCodePoint(char);
    } else {
      throw createSaxError("INVALID_PI");
    }
  }

  // @internal
  private parsePiTarget_() {
    this.element_ += this.readNameCharacters_();
    if (this.index_ < this.chunk_.length) {
      // Name read to completion
      if (this.element_.length === 3 && this.element_.toLowerCase() === "xml") {
        throw createSaxError("RESERVED_PI");
      }
      const codeUnit = this.chunk_.charCodeAt(this.index_);
      ++this.index_;
      if (isWhiteSpace(codeUnit)) {
        this.state_ = State.PI_CONTENT_START;
      } else if (codeUnit === Chars.QUESTION) {
        this.state_ = State.PI_END;
      } else {
        throw createSaxError("INVALID_PI");
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
      this.reader_.pi?.(this.element_, this.content_);
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
      throw createSaxError("INVALID_CHAR");
    }
    if (this.flags_ & Flags.CAPTURE_PI) {
      this.content_ += normalizeLineEndings(content);
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
      throw createSaxError("INVALID_PI");
    }
  }

  // @internal
  private parseCommentStart_() {
    if (this.chunk_.charCodeAt(this.index_) !== Chars.HYPHEN) {
      throw createSaxError("INVALID_CDATA");
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
      throw createSaxError("INVALID_CHAR");
    }
    if (this.flags_ & Flags.CAPTURE_COMMENT) {
      this.content_ += normalizeLineEndings(content);
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
      throw createSaxError("INVALID_COMMENT");
    }
  }

  // @internal
  private parseOpenAngleBracket_() {
    const char = this.chunk_.codePointAt(this.index_)!;
    ++this.index_;
    if (char > 0xFFFF) {
      ++this.index_;
    }
    if (isNameStartChar(char)) {
      this.element_ = String.fromCodePoint(char);
      // Cannot have two root elements
      if (
        this.elements_.length === 0 &&
        this.entityStack_.length === 0 &&
        this.flags_ & Flags.SEEN_ROOT
      ) {
        throw createSaxError("INVALID_START_TAG");
      }
      this.flags_ |= Flags.SEEN_ROOT;
      this.state_ = State.START_TAG_NAME;
    } else if (char === Chars.SLASH) {
      this.state_ = State.END_TAG_START;
    } else if (char === Chars.BANG) {
      this.state_ = State.OPEN_ANGLE_BRACKET_BANG;
    } else if (char === Chars.QUESTION) {
      this.state_ = State.PI_TARGET_START;
    } else {
      throw createSaxError("INVALID_START_TAG");
    }
  }

  // @internal
  private parseOpenAngleBracketBang_() {
    const codeUnit = this.chunk_.charCodeAt(this.index_);
    ++this.index_;
    if (codeUnit === Chars.HYPHEN) {
      this.state_ = State.COMMENT_START;
    } else if (codeUnit === Chars.OPEN_BRACKET && this.elements_.length !== 0) {
      this.state_ = State.CDATA_SECTION_START;
    } else if (codeUnit === 0x44 /* D */) {
      if (this.flags_ & Flags.SEEN_DOCTYPE || this.flags_ & Flags.SEEN_ROOT) {
        throw createSaxError("INVALID_DOCTYPE_DECL");
      }
      this.state_ = State.DOCTYPE_DECL_START;
    } else {
      throw createSaxError("INVALID_CDATA");
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
        this.attributes_.set(attribute, default_);
      }
    }
  }

  // @internal
  private startTagEnd_() {
    this.setDefaultAttributes_();
    this.state_ = State.TEXT_CONTENT;
    this.otherState_ = 0;
    this.reader_.start(this.element_, this.attributes_);
    this.elements_.push(this.element_);
    this.element_ = "";
    this.attributes_.clear();
  }

  // @internal
  private parseStartTagName_() {
    this.element_ += this.readNameCharacters_();
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
        throw createSaxError("INVALID_START_TAG");
      }
    }
  }

  // @internal
  private parseStartTag_() {
    if (this.skipWhiteSpace_()) {
      const char = this.chunk_.codePointAt(this.index_)!;
      ++this.index_;
      if (char > 0xFFFF) {
        ++this.index_;
      }
      if (isNameStartChar(char)) {
        this.state_ = State.START_TAG_ATTR;
        this.attribute_ = String.fromCodePoint(char);
      } else if (char === Chars.GT) {
        this.startTagEnd_();
      } else if (char === Chars.SLASH) {
        this.state_ = State.EMPTY_TAG;
      } else {
        throw createSaxError("INVALID_START_TAG");
      }
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
      throw createSaxError("INVALID_START_TAG");
    }
  }

  // @internal
  private parseStartTagAttr_() {
    this.attribute_ += this.readNameCharacters_();
    if (this.index_ < this.chunk_.length) {
      const codeUnit = this.chunk_.charCodeAt(this.index_);
      ++this.index_;
      if (codeUnit === Chars.EQ) {
        // Most likely case
        this.state_ = State.START_TAG_ATTR_VALUE;
      } else if (isWhiteSpace(codeUnit)) {
        this.state_ = State.START_TAG_ATTR_EQ;
      } else {
        throw createSaxError("INVALID_START_TAG");
      }
    }
  }

  // @internal
  private parseStartTagAttrEq_() {
    if (this.skipWhiteSpace_()) {
      if (this.chunk_.charCodeAt(this.index_) === Chars.EQ) {
        ++this.index_;
        this.state_ = State.START_TAG_ATTR_VALUE;
      } else {
        throw createSaxError("INVALID_START_TAG");
      }
    }
  }

  // @internal
  private parseStartTagAttrValue_() {
    if (this.skipWhiteSpace_()) {
      const codeUnit = this.chunk_.charCodeAt(this.index_);
      switch (codeUnit) {
        case Chars.APOSTROPHE:
        case Chars.QUOTE:
          this.quote_ = codeUnit;
          ++this.index_;
          this.state_ = State.START_TAG_ATTR_VALUE_QUOTED;
          break;
        default:
          throw createSaxError("INVALID_START_TAG");
      }
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
          this.content_ += this.chunk_.slice(start, this.index_) + " ";
          if (
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
          this.content_ += this.chunk_.slice(start, this.index_);
          ++this.index_;
          this.state_ = State.START_TAG_SPACE;
          if (this.attributes_.has(this.attribute_)) {
            throw createSaxError("DUPLICATE_ATTR");
          }
          const attlists = this.attlists_.get(this.element_);
          const attlist = attlists !== undefined
            ? attlists.get(this.attribute_)
            : undefined;
          const value = attlist !== undefined && attlist.isTokenized_
            ? normalizeAttributeValue(this.content_)
            : this.content_;
          this.attributes_.set(this.attribute_, value);
          this.attribute_ = "";
          this.content_ = "";
          return;
        }
        case Chars.LT:
          // < is not allowed inside attribute values
          throw createSaxError("LT_IN_ATTRIBUTE");
        default:
          // Other characters still need to be validated:
          if (codeUnit < 0x20 || codeUnit === 0xFFFE || codeUnit === 0xFFFF) {
            throw createSaxError("INVALID_CHAR");
          }
      }
      ++this.index_;
    }
    this.content_ += this.chunk_.slice(start, this.index_);
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
      this.reader_.empty(this.element_, this.attributes_);
      this.element_ = "";
      this.attributes_.clear();
    } else {
      throw createSaxError("INVALID_START_TAG");
    }
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
          // Carriage return requires new-line normalization
          this.content_ += this.chunk_.slice(start, this.index_) + "\n";
          if (this.chunk_.charCodeAt(this.index_ + 1) === Chars.LF) {
            ++this.index_;
          }
          start = this.index_ + 1;
          break;
          // State changing conditions:
        case Chars.AMPERSAND:
          // It was considered to handle references inline but they are not
          // common enough to justify doing more work here
          this.state_ = State.REFERENCE;
          this.otherState_ = State.TEXT_CONTENT;
          break loop;
        case Chars.LT:
          this.state_ = State.OPEN_ANGLE_BRACKET;
          this.otherState_ = State.TEXT_CONTENT;
          break loop;
        case Chars.GT:
          // Catch ]]>, this.otherState_ just stores the number of consecutive
          // brackets found.
          if (this.otherState_ > 1) {
            throw createSaxError("INVALID_CDEND");
          }
          break;
        default:
          // Other characters still need to be validated:
          if (codeUnit < 0x20 || codeUnit === 0xFFFE || codeUnit === 0xFFFF) {
            throw createSaxError("INVALID_CHAR");
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
    this.content_ += this.chunk_.slice(start, this.index_);
    // Emit text content as needed
    if (
      this.state_ !== State.TEXT_CONTENT ||
      (this.flags_ & Flags.OPT_INCOMPLETE_TEXT_NODES)
    ) {
      this.reader_.text(this.content_);
      this.content_ = "";
    }
    ++this.index_;
  }

  // @internal
  private parseReference_() {
    const char = this.chunk_.codePointAt(this.index_)!;
    ++this.index_;
    if (char > 0xFFFF) {
      ++this.index_;
    }
    if (isNameStartChar(char)) {
      this.entity_ = String.fromCodePoint(char);
      this.state_ = State.ENTITY_REF;
    } else if (char === Chars.HASH) {
      this.state_ = State.CHAR_REF;
    } else {
      throw createSaxError("INVALID_ENTITY_REF");
    }
  }

  // @internal
  private parseEntityRef_() {
    this.entity_ += this.readNameCharacters_();
    if (this.index_ >= this.chunk_.length) {
      return;
    }
    if (this.chunk_.charCodeAt(this.index_) !== Chars.SEMICOLON) {
      throw createSaxError("INVALID_ENTITY_REF");
    }
    ++this.index_;
    if (PREDEFINED_ENTITIES.hasOwnProperty(this.entity_)) {
      this.content_ +=
        PREDEFINED_ENTITIES[this.entity_ as keyof typeof PREDEFINED_ENTITIES];
    } else {
      // WFC: No Recursion
      if (this.entityStack_.indexOf(this.entity_) !== -1) {
        throw createSaxError("RECURSIVE_ENTITY", {entity: this.entity_});
      }

      // const isAttValue = this.otherState_ ===
      //   State.START_TAG_ATTR_VALUE_QUOTED;
      let entityValue = this.entities_.get(this.entity_);
      // Unparsed entities cannot be referenced anywhere.
      // WFC: Parsed Entity
      if (entityValue === EntityDecl.UNPARSED) {
        throw createSaxError("UNPARSED_ENTITY", {entity: this.entity_});
      }
      // Attribute values
      // WFC: No External Entity References
      if (
        this.otherState_ === State.START_TAG_ATTR_VALUE_QUOTED &&
        entityValue === EntityDecl.EXTERNAL
      ) {
        throw createSaxError("EXTERNAL_ENTITY", {entity: this.entity_});
      }
      // Allow the application to set a default value for an entity not
      // declared in internal markup declarations.
      if (
        entityValue === EntityDecl.EXTERNAL ||
        entityValue === undefined
      ) {
        entityValue = this.reader_.getGeneralEntity?.(this.entity_);
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
          // If the application does not handle undeclared entities throw an
          // error
          this.reader_.entityRef == null
        ) {
          throw createSaxError("UNDECLARED_ENTITY", {entity: this.entity_});
        }
        // Allow the application to handle undeclared entities in content.
        this.reader_.entityRef(this.entity_);
      } else {
        this.entityLength_ += entityValue.length;
        if (this.entityLength_ > this.maxEntityLength_) {
          throw createSaxError("LIMIT_EXCEEDED");
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
        //   throw createSaxError("INVALID_ATTRIBUTE_VALUE");
        // }
        // Entity value must match content production
        if (this.elements_.length !== 0 || this.state_ !== otherState) {
          throw createSaxError("UNEXPECTED_EOF");
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
      throw createSaxError("INVALID_CHAR_REF");
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
        throw createSaxError("INVALID_CHAR_REF");
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
          throw createSaxError("INVALID_CHAR_REF");
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
      throw createSaxError("INVALID_CDATA");
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
      throw createSaxError("INVALID_CHAR");
    }
    this.content_ += normalizeLineEndings(content);
    if (index === -1) {
      // Chunk is read to completion even on an ending hyphen, it will be
      // removed after the fact if the comment is ending.
      this.index_ = this.chunk_.length;
      // This chunk doesn't contain the end of this comment but it may contain
      // a trailing hyphen that has to be handled on the next chunk.
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
        this.reader_.text(this.content_);
        this.content_ = "";
      }
    } else {
      this.index_ = index + 2;
      this.state_ = State.CDATA_SECTION_END;
    }
  }

  // @internal
  private parseCdataSectionEnd0_() {
    const codeUnit = this.chunk_.charCodeAt(this.index_);
    ++this.index_;
    if (codeUnit === Chars.CLOSE_BRACKET) {
      this.state_ = State.CDATA_SECTION_END;
    } else {
      this.content_ += "]" + String.fromCharCode(codeUnit);
      this.state_ = State.CDATA_SECTION;
    }
  }

  // @internal
  private parseCdataSectionEnd_() {
    const codeUnit = this.chunk_.charCodeAt(this.index_);
    ++this.index_;
    if (codeUnit === Chars.GT) {
      this.state_ = State.TEXT_CONTENT;
      this.otherState_ = 0;
    } else if (codeUnit === Chars.CLOSE_BRACKET) {
      this.content_ += "]";
    } else {
      this.content_ += "]]" + String.fromCharCode(codeUnit);
      this.state_ = State.CDATA_SECTION;
    }
  }

  // @internal
  private parseEndTagStart_() {
    const char = this.chunk_.codePointAt(this.index_)!;
    ++this.index_;
    if (char > 0xFFFF) {
      ++this.index_;
    }
    if (isNameStartChar(char)) {
      this.state_ = State.END_TAG;
      this.element_ = String.fromCodePoint(char);
      // this.parseEndTag_();
    } else {
      throw createSaxError("INVALID_END_TAG");
    }
  }

  // @internal
  private parseEndTag_() {
    this.element_ += this.readNameCharacters_();
    if (this.index_ < this.chunk_.length) {
      this.state_ = State.END_TAG_END;
      this.parseEndTagEnd_();
    }
  }

  // @internal
  private parseEndTagEnd_() {
    if (this.skipWhiteSpace_()) {
      const codeUnit = this.chunk_.charCodeAt(this.index_);
      if (codeUnit !== Chars.GT || this.elements_.pop() !== this.element_) {
        throw createSaxError("INVALID_END_TAG");
      }
      ++this.index_;
      this.state_ =
        this.elements_.length === 0 && this.entityStack_.length === 0
          ? State.MISC
          : State.TEXT_CONTENT;
      this.otherState_ = 0;
      this.reader_.end(this.element_);
      this.element_ = "";
    }
  }

  // Internal functions

  // @internal
  private readNameCharacters_() {
    const start = this.index_;
    while (this.index_ < this.chunk_.length) {
      let char = this.chunk_.charCodeAt(this.index_)!;
      if (0xD800 <= char && char <= 0xDBFF) {
        char = 0x10000 + (char - 0xD800) * 0x400 +
          this.chunk_.charCodeAt(++this.index_);
      }
      if (!isNameChar(char)) {
        break;
      }
      ++this.index_;
    }
    return this.chunk_.slice(start, this.index_);
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
