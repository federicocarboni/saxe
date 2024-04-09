import {
  Chars,
  isAsciiDigit,
  isAsciiHexAlpha,
  isChar,
  isEncodingName,
  isNameChar,
  isNameStartChar,
  isWhitespace,
  isWhitespaceNonSP,
  parseDecCharRef as parseDec,
  parseHex,
} from "./chars.js";
import {createSaxError, SaxError} from "./error.js";

export {isSaxError, type SaxError, type SaxErrorCode} from "./error.js";

/**
 * XML Declaration (XMLDecl)
 *
 * ```xml
 * <?xml version="1.0" encoding="UTF-8" standalone="no" ?>
 * ```
 *
 * @since 1.0.0
 */
export interface XmlDeclaration {
  /**
   * Version declared in the XML Declaration.
   * @since 1.0.0
   */
  version: string;
  /**
   * Encoding declared in the XML Declaration, or `undefined` when unspecified.
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
  publicId?: string | undefined;
  systemId?: string | undefined;
}

/**
 * A processing instruction.
 *
 * ```xml
 * <?target content?>
 * ```
 * @since 1.0.0
 */
export interface Pi {
  /** Target name of the processing instruction. */
  target: string;
  /**
   * Content of the processing instruction or `undefined` if omitted.
   *
   * Empty and omitted content is subtly different:
   *
   * ```xml
   * <?target?><!-- omitted, content = undefined -->
   * <?target ?><!-- empty, content = "" -->
   * ```
   */
  content?: string | undefined;
}

interface SaxDtdHandler {
  start(
    name: string,
    publicId?: string | undefined,
    systemId?: string | undefined,
  ): void;
}

/**
 * @since 1.0.0
 */
export interface SaxReader {
  /**
   * Resolve an entity reference by name. Users are expected to handle `<!ENTITY ...>`
   * declarations in the DTD where applicable or have a hard coded set of
   * possible ones.
   *
   * It is responsability of the user to make sure that the returned contents do
   * not reference the entity recursively, as this will cause an infinite loop
   * which will crash the program!
   *
   * @param entity
   * @returns resolved entity contents or `undefined` if not found.
   */
  resolveEntityRef?(entity: string): string | undefined;
  /**
   * XML Declaration. Usually not required.
   * @param declaration
   */
  xml?(declaration: XmlDeclaration): void;
  /**
   * To improve performance, if processing instructions are not required do not
   * define this handler.
   * @param doctype
   */
  doctype?(doctype: Doctype): void;
  /**
   * A processing instruction `<?target content?>`. To improve performance, if
   * processing instructions are not required do not define this handler.
   * @param pi
   */
  pi?(pi: Pi): void;
  /**
   * A comment `<!-- text -->`. To improve performance, if comments are not
   * required do not define this handler.
   */
  comment?(text: string): void;
  /**
   * Start tag.
   *
   * ```xml
   * <element attr="value">
   * ```
   *
   * Attributes are passed to
   *
   * @param name
   * @param attributes
   */
  start(name: string, attributes: ReadonlyMap<string, string>): void;
  /**
   * An empty element.
   *
   * ```xml
   * <element attr="value" />
   * ```
   *
   * @param name
   * @param attributes
   */
  empty(name: string, attributes: ReadonlyMap<string, string>): void;
  /**
   * An end tag `</element>`.
   * @param name
   */
  end(name: string): void;
  /**
   * Text content of an element, `<element>text &amp; content</element>`
   * would produce text `"text & content"`.
   * @param text
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
   * non deterministic.
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
   * The same concept is also applied to CDATA sections.
   */
  incompleteTextNodes?: boolean | undefined;
  /**
   * To protect against malicious input this can be used to cap the number of
   * characters which can be produced while expanding an entity. If it is not
   * specified or set to `undefined` entity expansion is uncapped.
   *
   * It is recommended to set this to a sensible value when handling potentially
   * malicious input.
   */
  maxEntityLength?: number | undefined;
  // TODO: maxEntityLength should already be enough to prevent billion laughs
  //  attack and mitigate some other XML bomb exploits, is anything else needed?
  //  Possible other limits:
  // maxNestedEntityRef?: number | undefined;
  // maxAttributes?: number | undefined;
  // maxContentLength?: number | undefined;
}

const enum State {
  INIT,
  PROLOG,
  XML_DECL,
  XML_DECL_S,
  XML_DECL_VALUE,
  XML_DECL_VALUE_S,
  XML_DECL_VALUE_D,
  XML_DECL_END,
  DOCTYPE_DECL,
  DOCTYPE_NAME_S,
  DOCTYPE_NAME,
  DOCTYPE_EXTERNAL_ID,
  DOCTYPE_SYSTEM_ID,
  DOCTYPE_SYSTEM_ID_S,
  DOCTYPE_SYSTEM_ID_D,
  DOCTYPE_PUBLIC_ID,
  DOCTYPE_MAYBE_DTD,
  DOCTYPE_DTD,
  DOCTYPE_END,
  MISC,
  COMMENT,
  COMMENT_END,
  PI_TARGET_START,
  PI_TARGET,
  PI_CONTENT,
  PI_CONTENT_S,
  PI_EMPTY,
  OPEN_ANGLE_BRACKET,
  OPEN_ANGLE_BRACKET_BANG,
  START_TAG_NAME,
  START_TAG,
  START_TAG_ATTR_START,
  START_TAG_ATTR,
  START_TAG_ATTR_EQ,
  START_TAG_ATTR_VALUE,
  START_TAG_ATTR_VALUE_S,
  START_TAG_ATTR_VALUE_D,
  START_TAG_EMPTY,
  CONTENT,
  REFERENCE,
  ENTITY_REF,
  CHAR_REF,
  CHAR_REF_DEC,
  CHAR_REF_HEX,
  END_TAG_START,
  END_TAG,
  END_TAG_END,
  CDATA,
}

const enum Flags {
  INIT = 0,
  SEEN_XML_DECL = 1 << 0,
  SEEN_DOCTYPE = 1 << 1,
  SEEN_ROOT = 1 << 2,

  XML_VERSION = 1 << 3,
  XML_ENCODING = 1 << 4,
  XML_STANDALONE = 1 << 5,
  XML_ALL = Flags.XML_VERSION | Flags.XML_ENCODING | Flags.XML_STANDALONE,

  DOCTYPE_PUBLIC_ID = 1 << 6,
  DOCTYPE_DTD = 1 << 7,

  CARRIAGE_RETURN = 1 << 8,

  CAPTURE_DOCTYPE = 1 << 10,
  CAPTURE_PI = 1 << 11,
  CAPTURE_COMMENT = 1 << 12,

  OPT_INCOMPLETE_TEXT_NODES = 1 << 13,
}

// Normalize XML line endings.
function normalize(s: string) {
  return s.replace(/\r\n?/g, "\n");
}

// Even if predefined entities are declared somewhere in a DTD they MUST
// have replacement text equal to the predefined ones, so we can have fast
// cases for these.
// https://www.w3.org/TR/REC-xml/#sec-predefined-ent
function getPredefinedEntity(entityName: string) {
  switch (entityName) {
    case "amp":
      return "&";
    case "lt":
      return "<";
    case "gt":
      return ">";
    case "apos":
      return "'";
    case "quot":
      return '"';
  }
  return undefined;
}

/**
 * Streaming non-validating XML Parser enforcing well-formedness, it makes no
 * attempt to recover well-formedness errors.
 *
 * To optimize for efficiency the parser does not store line information.
 *
 * @since 1.0.0
 */
export class SaxParser {
  // @internal
  private reader_: SaxReader;

  // Options
  // @internal
  private maxEntityLength_: number | undefined;

  // State
  // @internal
  private chunk_ = "";
  // @internal
  private index_ = 0;
  // @internal
  private char_ = 0;
  // @internal
  private state_ = State.INIT;
  // Stores flags and boolean options.
  // @internal
  private flags_ = Flags.INIT;
  // @internal
  private charRef_ = 0;

  // Accumulators

  // Generic accumulator
  // @internal
  private accumulator_ = "";
  // Current attribute name (or XML Decl attribute value)
  // @internal
  private attributeName_ = "";
  // Current attribute value (or XML Decl attribute value)
  // @internal
  private attributeValue_ = "";
  // Current element name
  // @internal
  private element_ = "";
  // Current text content, contains decoded and normalized content
  // @internal
  private content_ = "";
  // Current attributes, this parser enforces well-formedness so an attribute
  // list cannot be avoided. To improve lookup times it uses a Map instead of a
  // plain object.
  // @internal
  private attributes_ = new Map<string, string>();
  // Current stack of XML elements, required to validate open and end tags.
  // @internal
  private elements_: string[] = [];

  // TODO: should we support xml:space and/or xml:lang scope?
  // @internal
  private xmlLang_: string | undefined;
  // @internal
  private xmlSpace_: string | undefined;

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
   * @param reader
   * @param options
   */
  constructor(reader: SaxReader, options: SaxOptions | undefined = undefined) {
    this.reader_ = reader;
    // Avoid capturing information that will be ignored
    if (this.reader_.doctype != null) {
      this.flags_ |= Flags.CAPTURE_DOCTYPE;
    }
    if (this.reader_.pi != null) {
      this.flags_ |= Flags.CAPTURE_PI;
    }
    if (this.reader_.comment != null) {
      this.flags_ |= Flags.CAPTURE_COMMENT;
    }
    if (options?.incompleteTextNodes) {
      this.flags_ |= Flags.OPT_INCOMPLETE_TEXT_NODES;
    }
    this.maxEntityLength_ = options?.maxEntityLength ?? undefined;
  }

  /**
   * @returns
   * @internal
   */
  getCurrentElements(): readonly string[] {
    return this.elements_;
  }

  /** @internal */
  getXmlLang() {
    return this.xmlLang_;
  }

  /**
   * Add more data for the parser to process. May be called repeatedly to parse
   * a streaming source.
   * @param input - string contents to parse
   * @throws {@link SaxError}
   * @since 1.0.0
   */
  write(input: string) {
    this.chunk_ += input;
    if (this.chunk_.length !== 0) {
      this.char_ = input.codePointAt(this.index_)!;
    }
    while (this.index_ < this.chunk_.length && this.runStateMachine_());
    // if (!this.run_()) {
    //   this.chunk_ = "";
    //   this.index_ = 0;
    // }

    // Chunk may not have been consumed completely
    this.chunk_ = this.chunk_.slice(this.index_);
    this.index_ = 0;
  }

  /**
   * Signal to the parser that the source has ended.
   * @throws {@link SaxError}
   * @since 1.0.0
   */
  end() {
    // if (this.run_()) throw createSaxError("TRUNCATED");
  }

  // Main parsing method
  // @internal
  private runStateMachine_() {
    switch (this.state_) {
      case State.INIT:
        // No well-formed XML Document can have less than 6 characters.
        if (this.chunk_.length < 6) {
          return false;
        }
        if (
          this.chunk_.slice(0, 5) === "<?xml" &&
          isWhitespace(this.chunk_.charCodeAt(5))
        ) {
          this.skipTo_(6);
          this.state_ = State.XML_DECL;
        } else {
          this.state_ = State.MISC;
        }
        break;
      case State.PROLOG:
        break;
      case State.XML_DECL:
        if (!this.skipWhitespace_()) {
          return false;
        }
        if (this.char_ === Chars.QUESTION) {
          this.advance_();
          this.state_ = State.XML_DECL_END;
        } else if (this.collectXmlAttributeName_()) {
          this.state_ = State.XML_DECL_VALUE;
        }
        break;
      case State.XML_DECL_S:
        if (this.char_ === Chars.QUESTION) {
          this.advance_();
          this.state_ = State.XML_DECL_END;
        } else if (isWhitespace(this.char_)) {
          this.advance_();
          this.state_ = State.XML_DECL;
        } else {
          throw createSaxError("INVALID_XML_DECL");
        }
        break;
      case State.XML_DECL_VALUE:
        if (!this.skipWhitespace_()) { return false; }
        if (this.char_ === Chars.APOSTROPHE) {
          this.state_ = State.XML_DECL_VALUE_S;
        } else if (this.char_ === Chars.QUOTE) {
          this.state_ = State.XML_DECL_VALUE_D;
        } else {
          throw createSaxError("INVALID_XML_DECL");
        }
        this.advance_();
        break;
      case State.XML_DECL_VALUE_S:
      case State.XML_DECL_VALUE_D:
        if (this.readQuotedValue_(this.state_ === State.XML_DECL_VALUE_S)) {
          this.handleXmlDeclAttr_();
          this.state_ = State.XML_DECL_S;
        }
        break;
      case State.XML_DECL_END:
        if (this.char_ !== Chars.GT || this.version_ === undefined) {
          throw createSaxError("INVALID_XML_DECL");
        }
        this.advance_();
        this.reader_.xml?.({
          version: this.version_,
          encoding: this.encoding_,
          standalone: this.standalone_,
        });
        this.state_ = State.MISC;
        break;
      case State.DOCTYPE_DECL:
      case State.DOCTYPE_NAME_S:
      case State.DOCTYPE_NAME:
      case State.DOCTYPE_EXTERNAL_ID:
      case State.DOCTYPE_SYSTEM_ID:
      case State.DOCTYPE_SYSTEM_ID_S:
      case State.DOCTYPE_SYSTEM_ID_D:
      case State.DOCTYPE_PUBLIC_ID:
      case State.DOCTYPE_MAYBE_DTD:
      case State.DOCTYPE_DTD:
      case State.DOCTYPE_END:
        throw new Error("not implemented");
      case State.MISC:
        if (!this.skipWhitespace_()) {
          return false;
        }
        if (this.char_ === Chars.LT) {
          this.state_ = State.OPEN_ANGLE_BRACKET;
        } else {
          throw createSaxError("INVALID_START_TAG");
        }
        this.advance_();
        break;
      case State.COMMENT:
        if (!this.readComment_()) { return false; }
        break;
      case State.COMMENT_END:
        if (this.char_ !== Chars.GT) {
          throw createSaxError("INVALID_COMMENT");
        }
        this.advance_();
        // Inside elements must return to CONTENT
        this.state_ = this.elements_.length === 0
          ? State.MISC
          : State.CONTENT;
        if (this.flags_ & Flags.CAPTURE_COMMENT) {
          this.reader_.comment?.(normalize(this.content_));
        }
        this.content_ = "";
        break;
      case State.PI_TARGET_START:
        if (!isNameStartChar(this.char_)) {
          throw createSaxError("INVALID_PI");
        }
        if (this.flags_ & Flags.CAPTURE_PI) {
          this.element_ = String.fromCodePoint(this.char_);
        }
        this.advance_();
        this.state_ = State.PI_TARGET;
        break;
      case State.PI_TARGET: {
        const start = this.index_;
        while (this.index_ < this.chunk_.length) {
          if (isWhitespace(this.char_)) {
            this.state_ = State.PI_CONTENT_S;
            break;
          } else if (this.char_ === Chars.QUESTION) {
            this.state_ = State.PI_EMPTY;
            break;
          } else if (!isNameChar(this.char_)) {
            throw createSaxError("INVALID_PI");
          }
          this.advance_();
        }
        this.element_ += this.chunk_.slice(start, this.index_);
        if (
          this.state_ !== State.PI_TARGET &&
          this.element_.toLowerCase() === "xml"
        ) {
          throw createSaxError("RESERVED_PI");
        }
        break;
      }
      case State.PI_CONTENT:
        if (!this.readPi_()) {
          return false;
        }
        break;
      case State.PI_CONTENT_S:
        if (!this.skipWhitespace_()) {
          return false;
        }
        this.state_ = State.PI_CONTENT;
        break;
      case State.PI_EMPTY:
        if (this.char_ !== Chars.GT) {
          throw createSaxError("INVALID_PI");
        }
        this.advance_();
        // Inside elements must return to CONTENT
        this.state_ = this.elements_.length === 0
          ? State.MISC
          : State.CONTENT;
        this.reader_.pi?.({
          target: this.element_,
          content: undefined,
        });
        this.element_ = "";
        break;
      case State.OPEN_ANGLE_BRACKET: {
        const char = this.char_;
        this.advance_();
        if (char === Chars.SLASH) {
          this.state_ = State.END_TAG_START;
        } else if (char === Chars.BANG) {
          this.state_ = State.OPEN_ANGLE_BRACKET_BANG;
        } else if (char === Chars.QUESTION) {
          this.state_ = State.PI_TARGET_START;
        } else if (isNameStartChar(char)) {
          this.state_ = State.START_TAG_NAME;
          this.element_ = String.fromCodePoint(char);
        } else {
          throw createSaxError("INVALID_START_TAG");
        }
        break;
      }
      case State.OPEN_ANGLE_BRACKET_BANG: {
        if (this.chunk_.slice(this.index_, this.index_ + 7) === "[CDATA[") {
          this.skipTo_(this.index_ + 7);
          this.state_ = State.CDATA;
        } else if (
          this.chunk_.slice(this.index_, this.index_ + 7) === "DOCTYPE"
        ) {
          if (
            this.flags_ & Flags.SEEN_DOCTYPE ||
            this.flags_ & Flags.SEEN_ROOT
          ) {
            throw createSaxError("INVALID_DOCTYPE");
          }
          this.skipTo_(this.index_ + 7);
          this.state_ = State.DOCTYPE_DECL;
        } else if (this.chunk_.slice(this.index_, this.index_ + 2) === "--") {
          this.skipTo_(this.index_ + 2);
          this.state_ = State.COMMENT;
        } else if (isNameStartChar(this.char_)) {
          this.state_ = State.START_TAG_NAME;
          this.element_ = String.fromCodePoint(this.char_);
          this.advance_();
        } else if (this.chunk_.length - this.index_ < 7) {
          return false;
        } else {
          throw createSaxError("INVALID_START_TAG");
        }
        break;
      }
      case State.START_TAG_NAME: {
        const start = this.index_;
        while (isNameChar(this.char_)) {
          this.advance_();
        }
        if (this.index_ < this.chunk_.length) {
          this.state_ = State.START_TAG;
        }
        this.element_ += this.chunk_.slice(start, this.index_);
        break;
      }
      case State.START_TAG:
        if (isWhitespace(this.char_)) {
          this.state_ = State.START_TAG_ATTR_START;
        } else if (this.char_ === Chars.GT) {
          this.state_ = State.CONTENT;
          this.emitStart_();
        } else if (this.char_ === Chars.SLASH) {
          this.state_ = State.START_TAG_EMPTY;
        } else {
          throw createSaxError("INVALID_START_TAG");
        }
        this.advance_();
        break;
      case State.START_TAG_ATTR_START:
        if (!this.skipWhitespace_()) { return false; }
        if (isNameStartChar(this.char_)) {
          this.state_ = State.START_TAG_ATTR;
        } else if (this.char_ === Chars.GT) {
          this.advance_();
          this.state_ = State.CONTENT;
          this.emitStart_();
        } else if (this.char_ === Chars.SLASH) {
          this.state_ = State.START_TAG_EMPTY;
          this.advance_();
        } else {
          throw createSaxError("INVALID_START_TAG");
        }
        break;
      case State.START_TAG_ATTR: {
        const start = this.index_;
        while (this.index_ < this.chunk_.length) {
          const char = this.char_;
          if (char === Chars.EQ) {
            this.state_ = State.START_TAG_ATTR_VALUE;
            break;
          } else if (isWhitespace(char)) {
            this.state_ = State.START_TAG_ATTR_EQ;
            break;
          } else if (!isNameChar(char)) {
            throw createSaxError("INVALID_START_TAG");
          }
          this.advance_();
        }
        this.attributeName_ += this.chunk_.slice(start, this.index_);
        if (this.state_ !== State.START_TAG_ATTR) {
          this.advance_();
        }
        break;
      }
      case State.START_TAG_ATTR_EQ:
        if (!this.skipWhitespace_()) {
          return false;
        }
        if (this.char_ === Chars.EQ) {
          this.state_ = State.START_TAG_ATTR_VALUE;
          this.advance_();
        } else {
          throw createSaxError("INVALID_START_TAG");
        }
        break;
      case State.START_TAG_ATTR_VALUE:
        if (!this.skipWhitespace_()) {
          return false;
        }
        if (this.char_ === Chars.QUOTE) {
          this.state_ = State.START_TAG_ATTR_VALUE_D;
        } else if (this.char_ === Chars.APOSTROPHE) {
          this.state_ = State.START_TAG_ATTR_VALUE_S;
        } else {
          throw createSaxError("INVALID_START_TAG");
        }
        this.advance_();
        break;
      case State.START_TAG_ATTR_VALUE_S:
      case State.START_TAG_ATTR_VALUE_D: {
        const isSingleQuote = this.state_ === State.START_TAG_ATTR_VALUE_S;
        if (this.readQuotedValue_(isSingleQuote)) {
          if (this.attributes_.has(this.attributeName_)) {
            throw createSaxError("DUPLICATE_ATTR");
          }
          this.state_ = State.START_TAG;
          this.attributes_.set(
            this.attributeName_,
            this.normalizeAttrValue_(this.attributeValue_),
          );
          this.attributeName_ = "";
          this.attributeValue_ = "";
        }
        break;
      }
      case State.START_TAG_EMPTY:
        if (this.char_ !== Chars.GT) {
          throw createSaxError("INVALID_START_TAG");
        }
        this.advance_();
        this.reader_.empty(this.element_, this.attributes_);
        this.element_ = "";
        this.attributes_.clear();
        break;
      case State.CONTENT: {
        // TODO: check if this is actually faster than a single loop
        const openWaka = this.chunk_.indexOf("<", this.index_);
        const amp = this.chunk_.indexOf("&", this.index_);
        if (amp !== -1) {
          this.content_ += normalize(this.chunk_.slice(this.index_, amp));
          this.skipTo_(amp + 1);
          this.emitIncompleteText_();
          this.state_ = State.REFERENCE;
        } else if (openWaka !== -1) {
          this.content_ += normalize(this.chunk_.slice(this.index_, openWaka));
          this.skipTo_(openWaka + 1);
          this.emitText_();
          this.state_ = State.OPEN_ANGLE_BRACKET;
        } else {
          const end =
            this.chunk_.charCodeAt(this.chunk_.length - 1) === Chars.CR
              ? this.chunk_.length - 1
              : this.chunk_.length;
          this.content_ += normalize(this.chunk_.slice(this.index_, end));
          this.skipTo_(end);
          this.emitIncompleteText_();
          return false;
        }
        break;
      }
      case State.REFERENCE:
        if (isNameStartChar(this.char_)) {
          this.state_ = State.ENTITY_REF;
          this.element_ = String.fromCodePoint(this.char_);
        } else if (this.char_ === Chars.HASH) {
          this.state_ = State.CHAR_REF;
        } else {
          throw createSaxError("INVALID_ENTITY_REF");
        }
        this.advance_();
        break;
      case State.ENTITY_REF: {
        const start = this.index_;
        while (this.index_ < this.chunk_.length) {
          if (this.char_ === Chars.SEMICOLON) {
            this.state_ = State.CONTENT;
            break;
          } else if (!isNameChar(this.char_)) {
            throw createSaxError("INVALID_ENTITY_REF");
          }
          this.advance_();
        }
        this.element_ += this.chunk_.slice(start, this.index_);
        if (this.state_ !== State.ENTITY_REF) {
          this.advance_();
          const entityValue = getPredefinedEntity(this.element_);
          this.content_ += entityValue === undefined
            ? this.resolveEntityRef_(this.element_)
            : entityValue;
          this.element_ = "";
          if (entityValue === undefined) {
            this.emitIncompleteText_();
          }
        }
        break;
      }
      case State.CHAR_REF:
        if (this.char_ === Chars.LOWER_X) {
          this.advance_();
          this.state_ = State.CHAR_REF_HEX;
        } else {
          this.state_ = State.CHAR_REF_DEC;
        }
        break;
      case State.CHAR_REF_DEC:
        while (this.index_ < this.chunk_.length) {
          const char = this.char_;
          this.advance_();
          if (char === Chars.SEMICOLON) {
            this.state_ = State.CONTENT;
            break;
          } else {
            const digit = (char - 0x30) >>> 0;
            if (digit > 9) {
              throw createSaxError("INVALID_CHAR_REF", {char: undefined});
            }
            this.charRef_ = this.charRef_ * 10 + digit;
          }
        }
        if (this.state_ !== State.CHAR_REF_DEC) {
          this.appendCharRef_();
        }
        break;
      case State.CHAR_REF_HEX:
        while (this.index_ < this.chunk_.length) {
          const char = this.char_;
          this.advance_();
          if (char === Chars.SEMICOLON) {
            this.state_ = State.CONTENT;
            break;
          } else {
            let digit;
            if (isAsciiDigit(char)) {
              digit = char - 0x30;
            } else if (isAsciiHexAlpha(char)) {
              digit = (char | 0x20) - 0x57;
            } else {
              throw createSaxError("INVALID_CHAR_REF", {char: undefined});
            }
            this.charRef_ = this.charRef_ * 16 + digit;
          }
        }
        if (this.state_ !== State.CHAR_REF_HEX) {
          this.appendCharRef_();
        }
        break;
      case State.END_TAG_START:
        if (!isNameStartChar(this.char_)) {
          throw createSaxError("INVALID_END_TAG");
        }
        this.element_ = String.fromCodePoint(this.char_);
        this.state_ = State.END_TAG;
        this.advance_();
        break;
      case State.END_TAG: {
        const start = this.index_;
        while (this.index_ < this.chunk_.length) {
          if (!isNameChar(this.char_)) {
            this.state_ = State.END_TAG_END;
            break;
          }
          this.advance_();
        }
        this.element_ += this.chunk_.slice(start, this.index_);
        break;
      }
      case State.END_TAG_END:
        if (!this.skipWhitespace_()) {
          return false;
        }
        // For well-formedness also verify that the element we're ending was
        // last started
        if (
          this.char_ !== Chars.GT ||
          this.elements_.pop() !== this.element_
        ) {
          throw createSaxError("INVALID_END_TAG");
        }
        this.advance_();
        this.reader_.end(this.element_);
        this.element_ = "";
        this.state_ = this.elements_.length === 0
          ? State.MISC
          : State.CONTENT;
        break;
      case State.CDATA: {
        const isCdataEnd = this.readCdataSection_();
        if (isCdataEnd) {
          // CDATA is just raw text and not actually a node in and of itself, so
          // it won't call the text handler.
          this.state_ = State.CONTENT;
        }
        this.emitIncompleteText_();
        return isCdataEnd;
      }
    }
    return true;
  }

  // @internal
  private emitStart_() {
    this.elements_.push(this.element_);
    this.reader_.start(this.element_, this.attributes_);
    this.element_ = "";
    this.attributes_.clear();
  }

  // @internal
  private emitIncompleteText_() {
    if (this.flags_ & Flags.OPT_INCOMPLETE_TEXT_NODES) {
      this.emitText_();
    }
  }

  // @internal
  private emitText_() {
    this.reader_.text(this.content_);
    this.content_ = "";
  }

  // @internal
  private appendCharRef_() {
    if (!isChar(this.charRef_)) {
      throw createSaxError("INVALID_CHAR_REF", {char: this.charRef_});
    }
    this.content_ += String.fromCodePoint(this.charRef_);
    this.charRef_ = 0;
  }

  // @internal
  private skipTo_(index: number) {
    this.index_ = index;
    this.char_ = this.chunk_.codePointAt(this.index_)!;
  }

  // @internal
  private advance_() {
    this.index_ += 1 + +(this.char_ > 0xffff);
    this.char_ = this.chunk_.codePointAt(this.index_)!;
  }

  // @internal
  private collectXmlAttributeName_() {
    const index = this.chunk_.indexOf("=", this.index_);
    let end = index;
    if (end === -1) {
      end = this.chunk_.length;
    } else {
      // Remove whitespace from the end
      while (isWhitespace(this.chunk_.charCodeAt(--end)));
      end++;
    }
    this.attributeName_ += this.chunk_.slice(this.index_, end);
    this.skipTo_(end + 1);
    return index !== -1;
  }

  // @internal
  private readComment_() {
    // indexOf is highly optimized native code, so we can skip over a (probably)
    // large number of code points without having to read them manually.
    // This also means that we have no way to track line and column info, and
    // not even character offsets (JavaScript charCodes are not characters).
    // Comments end at --
    const index = this.chunk_.indexOf("--", this.index_);
    const end = index === -1 ? this.chunk_.length - 1 : index;
    if (this.flags_ & Flags.CAPTURE_COMMENT) {
      this.content_ += this.chunk_.slice(this.index_, end);
    }
    this.skipTo_(index !== -1 ? end + 2 : end);
    if (index !== -1) {
      this.state_ = State.COMMENT_END;
    }
    return index !== -1;
  }

  // @internal
  private readPi_() {
    const index = this.chunk_.indexOf("?>", this.index_);
    const end = index === -1 ? this.chunk_.length - 1 : index;
    if (this.flags_ & Flags.CAPTURE_PI) {
      this.content_ += this.chunk_.slice(this.index_, end);
    }
    this.skipTo_(index !== -1 ? end + 2 : end);
    if (index !== -1) {
      this.state_ = this.elements_.length === 0 ? State.MISC : State.COMMENT;
      // Only line endings are normalized in PI content. Anything else,
      // entity references char references etc... is just passed through.
      this.reader_.pi?.({
        target: this.element_,
        content: normalize(this.content_),
      });
      this.element_ = "";
      this.content_ = "";
    }
    return index !== -1;
  }

  // @internal
  private readCdataSection_() {
    if (this.chunk_.length < 3) {
      return false;
    }
    const index = this.chunk_.indexOf("]]>", this.index_);
    let end = index === -1 ? this.chunk_.length - 2 : index;
    // Ending carriage return is handled in the next chunk
    if (index === -1 && this.chunk_.charCodeAt(end - 1) === Chars.CR) {
      end--;
    }
    // CDATA sections cannot contains any escape sequences but line ending
    // normalization is still required
    this.content_ += normalize(this.chunk_.slice(this.index_, end));
    this.skipTo_(index !== -1 ? end + 2 : end);
    return index !== -1;
  }

  // @internal
  private readContent_() {
    const index = this.chunk_.indexOf("<", this.index_);
    if (index === -1) {
    }
    this.chunk_.indexOf("&");
  }

  // Read a quoted attribute value into attributeValue.
  // @internal
  private readQuotedValue_(isSingleQuote: boolean) {
    const quote = this.chunk_.indexOf(isSingleQuote ? "'" : '"', this.index_);
    const end = quote === -1 ? this.chunk_.length : quote;
    this.attributeValue_ += this.chunk_.slice(this.index_, end);
    this.skipTo_(end + 1);
    return quote !== -1;
  }

  // @internal
  private checkEntityLength_(content: string) {
    if (content.length > this.maxEntityLength_!) {
      throw createSaxError("MAX_ENTITY_LENGTH_EXCEEDED");
    }
    return content;
  }

  // This parser is not a validating parser so all values are read as CDATA.
  // This is the specialized algorithm for handling attribute values.
  // https://www.w3.org/TR/REC-xml/#AVNormalize
  // @internal
  private normalizeAttrValue_(value: string) {
    let normalized = "";
    let start = 0;
    let index = 0;
    const length = value.length;
    while (index < length) {
      const char = value.charCodeAt(index)!;
      if (char === Chars.AMP) {
        normalized += value.slice(start, index);
        const startChar = value.codePointAt(++index)!;
        const end = value.indexOf(";", index);
        if (end === -1) {
          throw createSaxError("INVALID_ENTITY_REF");
        }
        if (isNameStartChar(startChar)) {
          const entityName = value.slice(index, end);
          index += 1 + +(startChar > 0xFFFF);
          while (index < end) {
            const c = value.codePointAt(index)!;
            if (!isNameChar(c)) {
              throw createSaxError("INVALID_ENTITY_REF");
            }
            index += 1 + +(c > 0xFFFF);
          }
          const entityValue = getPredefinedEntity(entityName);
          normalized += entityValue !== undefined
            ? entityValue
            // Verify max entity length is not exceeded.
            : this.checkEntityLength_(
              this.normalizeAttrValue_(this.resolveEntityRef_(entityName)),
            );
          start = index + 1;
        } else if (startChar === Chars.HASH) {
          normalized += this.parseCharRef_(value.slice(index + 1, end));
        } else {
          throw createSaxError("INVALID_ENTITY_REF");
        }
        start = end + 1;
      } else if (isWhitespaceNonSP(char)) {
        if (char === Chars.CR && value.charCodeAt(index + 1) === Chars.LF) {
          index++;
        }
        normalized += value.slice(start, index) + " ";
        start = index + 1;
      } else if (char === Chars.LT) {
        throw createSaxError("INVALID_ATTRIBUTE_VALUE");
      }
      index++;
    }
    return normalized;
  }

  // Parse a char reference and return the a single character string of its
  // referenced value.
  // value is just the numeric part prefixed with x when hex
  // @internal
  private parseCharRef_(value: string) {
    const char = value.charCodeAt(0) === Chars.LOWER_X
      ? parseHex(value.slice(1))
      : parseDec(value);
    if (char === undefined || !isChar(char)) {
      throw createSaxError("INVALID_CHAR_REF", {char});
    }
    return String.fromCodePoint(char);
  }

  // Does not handle predefined entities.
  // @internal
  private resolveEntityRef_(entity: string) {
    const entityValue = this.reader_.resolveEntityRef?.(entity);
    if (entityValue == null) {
      throw createSaxError("UNRESOLVED_ENTITY", {entity});
    }
    if (entityValue.length > this.maxEntityLength_!) {
      throw createSaxError("MAX_ENTITY_LENGTH_EXCEEDED");
    }
    return entityValue;
  }

  // Handle an XML Decl attribute, validate its value and place it into version_
  // encoding_ or standalone_
  // @internal
  private handleXmlDeclAttr_() {
    // XMLDecl must also validate the order of attributes
    switch (this.attributeName_) {
      case "version":
        if (
          (this.flags_ & Flags.XML_ALL) !== Flags.INIT ||
          this.attributeValue_.length !== 3 ||
          this.attributeValue_.slice(0, 2) !== "1." ||
          !isAsciiDigit(this.attributeValue_.charCodeAt(2))
        ) {
          throw createSaxError("INVALID_XML_DECL");
        }
        this.version_ = this.attributeValue_;
        this.flags_ |= Flags.XML_VERSION;
        break;
      case "encoding":
        if (
          (this.flags_ & Flags.XML_ALL) !== Flags.XML_VERSION ||
          !isEncodingName(this.attributeValue_)
        ) {
          throw createSaxError("INVALID_XML_DECL");
        }
        this.encoding_ = this.attributeValue_.toLowerCase();
        this.flags_ |= Flags.XML_ENCODING;
        break;
      case "standalone":
        if (
          (this.flags_ & Flags.XML_VERSION) === 0 ||
          (this.flags_ & Flags.XML_STANDALONE) !== 0 ||
          (this.attributeValue_ !== "yes" && this.attributeValue_ !== "no")
        ) {
          throw createSaxError("INVALID_XML_DECL");
        }
        this.standalone_ = this.attributeValue_ === "yes";
        this.flags_ |= Flags.XML_STANDALONE;
        break;
      default:
        throw createSaxError("INVALID_XML_DECL");
    }
    this.attributeName_ = "";
    this.attributeValue_ = "";
  }

  // @internal
  private skipWhitespace_() {
    while (this.index_ < this.chunk_.length) {
      if (!isWhitespace(this.char_)) { break; }
      this.advance_();
    }
    return this.index_ !== this.chunk_.length;
  }
}
