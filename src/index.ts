/**
 * @author Federico Carboni
 */

import {
  Chars,
  hasInvalidChar,
  isChar,
  isNameChar,
  isNameStartChar,
  isWhitespace,
} from "./chars.ts";
import {createSaxError} from "./error.ts";

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
   * The parser does not validate that the encoding labels is one of the
   * officially assigned [IANA Character Sets].
   *
   * [IANA Character Sets]:
   * https://www.iana.org/assignments/character-sets/character-sets.xhtml
   * @since 1.0.0
   */
  encoding?: string | undefined;
  /**
   * Standalone value declared in the XML Declaration. `true` when set to `yes`,
   * `false` when set to `no`, or `undefined` when unspecified (should be
   * treated as a `false`).
   * @since 1.0.0
   */
  standalone?: boolean | undefined;
}

export interface Doctype {
  name: string;
  // TODO: does anyone need these?
  // publicId?: string | undefined;
  // systemId?: string | undefined;
}

/**
 * https://www.w3.org/TR/REC-xml/
 * @since 1.0.0
 */
export interface SaxReader {
  xml?(declaration: XmlDeclaration): void;
  /**
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
   * @since 1.0.0
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
   * Implementations should return the expanded value for the given entity.
   * Entities may contain character references and other entity references, the
   * parser assumes this has already been done by the user and appends the
   * returned string to the attribute value.
   *
   * If an entity is not recognized by the implementation it should just return
   * `undefined`.
   *
   * **Note**: this is not called for predefined general entity references or
   * inside text content as those may contain markup, see {@link entityRef}.
   * @param entity -
   * @returns Entity value or `undefined` if not recognized
   */
  replaceEntityRef?(entity: string): string | undefined;
  /**
   * A general entity reference which is not predefined; `&amp;`, `&lt;`, `&gt`,
   * `&apos;` and `&quot;` are recognized by the parser and replaced .
   *
   * ```xml
   * &entity;
   * ```
   *
   * **Note**: this is not called for general entity references inside attribute
   * values as those are replaced immediately by the parser. Attribute values
   * use {@link replaceEntityRef} instead.
   * @param entity - referenced entity name
   */
  entityRef(entity: string): void;
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
   *
   * @default false
   */
  incompleteTextNodes?: boolean | undefined;
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
  DOCTYPE_ANY,
  DOCTYPE_ANY_QUOTED,
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
  SEEN_DOCTYPE = 1 << 10,
  SEEN_ROOT = 1 << 11,
}

// Normalize XML line endings.
function normalizeLineEndings(s: string) {
  return s.replace(/\r\n?/g, "\n");
}

// Even if predefined entities are declared somewhere in a DTD they MUST
// have replacement text that produces text exactly equal to the predefined
// ones, so we can have treat them essentially the same as a char reference.
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
  // nothing here yet

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
  private charRef_ = 0;
  // @internal
  private quote_ = -1;

  // @internal
  private elements_: string[] = [];

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
      case State.DOCTYPE_ANY:
        return this.parseDoctypeAny_();
      case State.DOCTYPE_ANY_QUOTED:
        return this.parseDoctypeAnyQuoted_();
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
      isWhitespace(this.element_.charCodeAt(5))
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
      // Remove whitespace from the end
      while (isWhitespace(this.chunk_.charCodeAt(--end)));
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
    if (this.skipWhitespace_()) {
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
    if (!isWhitespace(codeUnit) && codeUnit !== Chars.QUESTION) {
      throw createSaxError("INVALID_XML_DECL");
    }
    this.state_ = State.XML_DECL;
    this.parseXmlDecl_();
  }

  // @internal
  private parseXmlDeclValue_() {
    if (this.skipWhitespace_()) {
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
      isWhitespace(this.element_.charCodeAt(6))
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
    if (!this.skipWhitespace_()) {
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
    this.reader_.doctype?.({name: this.element_});
    this.element_ = "";
    this.state_ = State.MISC;
  }

  // @internal
  private parseDoctypeNameEnd_() {
    if (!this.skipWhitespace_()) {
      return;
    }
    const codeUnit = this.chunk_.charCodeAt(this.index_);
    if (codeUnit === Chars.GT) {
      this.doctypeEnd_();
      return;
    }
    this.otherState_ = 0;
    if (codeUnit === Chars.OPEN_BRACKET) {
      ++this.index_;
      ++this.otherState_;
    }
    this.state_ = State.DOCTYPE_ANY;
  }

  // @internal
  private parseDoctypeAny_() {
    while (this.index_ < this.chunk_.length) {
      const codeUnit = this.chunk_.charCodeAt(this.index_);
      switch (codeUnit) {
        case Chars.APOSTROPHE:
        case Chars.QUOTE:
          this.quote_ = codeUnit;
          ++this.index_;
          this.state_ = State.DOCTYPE_ANY_QUOTED;
          return;
        case Chars.OPEN_BRACKET:
          ++this.otherState_;
          break;
        case Chars.CLOSE_BRACKET:
          --this.otherState_;
          break;
        case Chars.GT:
          if (this.otherState_ === 0) {
            this.doctypeEnd_();
            return;
          }
          break;
      }
      ++this.index_;
    }
  }

  // @internal
  private parseDoctypeAnyQuoted_() {
    const index = this.chunk_.indexOf(
      this.quote_ === Chars.APOSTROPHE ? "'" : '"',
      this.index_,
    );
    if (index === -1) {
      this.index_ = this.chunk_.length;
    } else {
      this.index_ = index + 1;
      this.state_ = State.DOCTYPE_ANY;
    }
  }
  // @internal
  private parseMisc_() {
    if (this.skipWhitespace_()) {
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
      if (isWhitespace(codeUnit)) {
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
    if (this.skipWhitespace_()) {
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
      if (this.elements_.length === 0 && this.flags_ & Flags.SEEN_ROOT) {
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
  private startTagEnd_() {
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
      } else if (isWhitespace(codeUnit)) {
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
    if (this.skipWhitespace_()) {
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
    } else if (isWhitespace(codeUnit)) {
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
      } else if (isWhitespace(codeUnit)) {
        this.state_ = State.START_TAG_ATTR_EQ;
      } else {
        throw createSaxError("INVALID_START_TAG");
      }
    }
  }

  // @internal
  private parseStartTagAttrEq_() {
    if (this.skipWhitespace_()) {
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
    if (this.skipWhitespace_()) {
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
        case quote:
          this.content_ += this.chunk_.slice(start, this.index_);
          ++this.index_;
          this.state_ = State.START_TAG_SPACE;
          if (this.attributes_.has(this.attribute_)) {
            throw createSaxError("DUPLICATE_ATTR");
          }
          this.attributes_.set(this.attribute_, this.content_);
          this.attribute_ = "";
          this.content_ = "";
          return;
        case Chars.LT:
          // < is not allowed inside attribute values
          throw createSaxError("INVALID_ATTRIBUTE_VALUE");
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
      // Empty tag could still be the root element
      this.state_ = this.elements_.length !== 0
        ? State.TEXT_CONTENT
        : State.MISC;
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
          // TODO: add significant whitespace handler?
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
    if (this.index_ < this.chunk_.length) {
      if (this.chunk_.charCodeAt(this.index_) !== Chars.SEMICOLON) {
        throw createSaxError("INVALID_ENTITY_REF");
      }
      if (PREDEFINED_ENTITIES.hasOwnProperty(this.entity_)) {
        this.content_ +=
          PREDEFINED_ENTITIES[this.entity_ as keyof typeof PREDEFINED_ENTITIES];
      } else if (this.otherState_ === State.START_TAG_ATTR_VALUE_QUOTED) {
        const entityValue = this.reader_.replaceEntityRef?.(this.entity_);
        if (entityValue == null) {
          throw createSaxError("UNRESOLVED_ENTITY", {entity: this.entity_});
        }
        this.content_ += entityValue;
      } else {
        this.reader_.entityRef(this.entity_);
      }
      ++this.index_;
      this.state_ = this.otherState_;
      this.otherState_ = 0;
      this.entity_ = "";
    }
  }

  // @internal
  private parseCharRef_() {
    if (this.chunk_.charCodeAt(this.index_) === Chars.LOWER_X) {
      ++this.index_;
      this.state_ = State.CHAR_REF_HEX;
    } else {
      this.state_ = State.CHAR_REF_DEC;
      this.parseCharRefDec_();
    }
  }

  // @internal
  private handleCharRef_() {
    // Skip semicolon ;
    ++this.index_;
    // TODO: 0 is not allowed so both explicit zero &#0; and zero size number
    //  &#; end up throwing here, but there's no way to know which one it is now
    if (!isChar(this.charRef_)) {
      throw createSaxError("INVALID_CHAR_REF", {char: this.charRef_});
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
        throw createSaxError("INVALID_CHAR_REF", {char: undefined});
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
          throw createSaxError("INVALID_CHAR_REF", {char: undefined});
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
    if (this.skipWhitespace_()) {
      const codeUnit = this.chunk_.charCodeAt(this.index_);
      if (codeUnit !== Chars.GT || this.elements_.pop() !== this.element_) {
        throw createSaxError("INVALID_END_TAG");
      }
      ++this.index_;
      this.state_ = this.elements_.length === 0
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
  private skipWhitespace_() {
    while (this.index_ < this.chunk_.length) {
      if (!isWhitespace(this.chunk_.charCodeAt(this.index_))) {
        break;
      }
      ++this.index_;
    }
    return this.index_ !== this.chunk_.length;
  }
}
