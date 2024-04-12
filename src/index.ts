/**
 * @author Federico Carboni
 */

import {
  Chars,
  hasInvalidChar,
  isAsciiDigit,
  isAsciiHexAlpha,
  isChar,
  isEncodingName,
  isNameChar,
  isNameStartChar,
  isWhitespace,
  isWhitespaceNonSP,
  parseDecCharRef,
  parseHex,
} from "./chars.js";
import {createSaxError} from "./error.js";

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
   * Version declared in the XML Declaration. Generally `1.0` or `1.1`, this
   * parser does not explicitly support XML `1.1` but differences are minimal
   * so most documents parse correctly.
   *
   * @since 1.0.0
   */
  version: string;
  /**
   * Encoding in the XML Declaration, or `undefined` when unspecified. The
   * encoding label is in upper case because official names are upper case and
   * encoding labels should be processed in a case-insensiteve way.
   *
   * The parser does not validate that the encoding labels is one of the
   * officially assigned [IANA Character Sets].
   *
   * [IANA Character Sets]:
   * https://www.iana.org/assignments/character-sets/character-sets.xhtml
   *
   * @since 1.0.0
   */
  encoding?: string | undefined;
  /**
   * Standalone value declared in the XML Declaration. `true` when set to `yes`,
   * `false` when set to `no`, or `undefined` when unspecified (should be
   * treated as a `false`).
   *
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
  content: string;
}

/**
 * @since 1.0.0
 */
export interface SaxReader {
  /**
   * Returns the replacement text for a given entity name. This is needed for
   * attribute values, entity references in content are handled by `entityRef`
   * unless `textOnlyEntities` is enabled.
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
   * A processing instruction `<?target content?>`. To improve performance, if
   * processing instructions are not required do not define this handler.
   * @param pi
   */
  pi?(target: string, content: string): void;
  /**
   * A comment `<!-- text -->`. To improve performance, if comments are not
   * required do not define this handler.
   */
  comment?(text: string): void;
  /**
   * To improve performance, if processing instructions are not required do not
   * define this handler.
   * @param doctype
   */
  doctype?(doctype: Doctype): void;
  /**
   * A general entity reference.
   *
   * @param context
   * @param entity - referenced entity name
   */
  entityRef?(entity: string): void;
  /**
   * Start tag.
   *
   * ```xml
   * <element attr="value">
   * ```
   *
   * @param context -
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
   * Text content of an element.
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
   *
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
  // /**
  //  * Entity expansion is not implemented (yet?) for markup content, so any
  //  * entity reference in XML content must be handled in `entityRef` or, this
  //  * option should be enabled to simply append the result of `resolveEntityRef`
  //  * to the content without any processing. This behavior is not standard for
  //  * entities which contain markup or escapes, so use with caution!
  //  */
  // textOnlyEntities?: boolean | undefined;
  processDtd?: "prohibit" | "ignore" | undefined;
  /**
   * To protect against malicious input this can be used to cap the number of
   * characters which can be produced while expanding an entity. If it is not
   * specified or set to `undefined` entity expansion is uncapped. By number of
   * characters
   *
   * It is recommended to set this to a sensible value when handling potentially
   * malicious input.
   */
  maxEntityLength?: number | undefined;
  // TODO: maxEntityLength should already be enough to prevent billion laughs
  //  attack and mitigate some other XML bomb exploits, is anything else needed?
  //  Possible other limits:
  // maxNestedEntities?: number | undefined;
  // maxAttributes?: number | undefined;
  // maxAttributeLength?: number | undefined;
  // maxTextLength?: number | undefined;
}

const enum State {
  INIT,
  XML_DECL,
  XML_DECL_S,
  XML_DECL_VALUE,
  XML_DECL_VALUE_S,
  XML_DECL_VALUE_D,
  XML_DECL_END,
  DOCTYPE_DECL,
  DOCTYPE_NAME_START,
  DOCTYPE_NAME,
  DOCTYPE_NAME_END,
  DOCTYPE_MAYBE_EXTERNAL_ID,
  DOCTYPE_EXTERNAL_ID,
  DOCTYPE_SYSTEM_ID,
  DOCTYPE_SYSTEM_ID_S,
  DOCTYPE_SYSTEM_ID_D,
  DOCTYPE_PUBLIC_ID,
  DOCTYPE_PUBLIC_ID_S,
  DOCTYPE_PUBLIC_ID_D,
  DOCTYPE_PUBLIC_ID_END,
  DOCTYPE_MAYBE_DTD,
  DOCTYPE_DTD,
  DOCTYPE_DTD_OPEN_BRACKET,
  DOCTYPE_DTD_OPEN_BRACKET_BANG,
  DOCTYPE_DTD_QUOTED_S,
  DOCTYPE_DTD_QUOTED_D,
  DOCTYPE_END,
  MISC,
  PI_TARGET_START,
  PI_TARGET,
  PI_CONTENT_START,
  PI_CONTENT,
  PI_CONTENT_END,
  PI_END,
  COMMENT,
  COMMENT_HYPHEN,
  COMMENT_END,
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
  TEXT_CONTENT,
  REFERENCE,
  ENTITY_REF,
  CHAR_REF,
  CHAR_REF_DEC,
  CHAR_REF_HEX,
  END_TAG_START,
  END_TAG,
  END_TAG_END,
  CDATA_SECTION,
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
  RESERVED_ = 1 << 2,
  // These are boolean properties in SaxOptions
  OPT_STRICT_CHAR = 1 << 3,
  OPT_INCOMPLETE_TEXT_NODES = 1 << 4,
  // OPT_TEXT_ONLY_ENTITIES = 1 << 5,

  // Runtime flags:
  CR = 1 << 9,
  SEEN_DOCTYPE = 1 << 10,
  SEEN_ROOT = 1 << 11,
}

function debugFlags(flags: Flags) {
  return {
    isCapturePi: !!(flags & Flags.CAPTURE_PI),
    isCaptureComment: !!(flags & Flags.CAPTURE_COMMENT),
    isIncompleteTextNodes: !!(flags & Flags.OPT_INCOMPLETE_TEXT_NODES),
    // isTextOnlyEntities: !!(flags & Flags.OPT_TEXT_ONLY_ENTITIES),
  };
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

// These are internal until we can define how namespace support will work.
// @internal
export function getPrefix(name: string): string | undefined {
  const colon = name.indexOf(":");
  if (colon === -1) {
    return name;
  }
  const prefix = name.slice(0, colon);
  return colon === 0 || colon === name.length - 1 ? undefined : prefix;
}

// @internal
export function getLocal(name: string): string | undefined {
  const colon = name.indexOf(":");
  if (colon === -1) {
    return name;
  }
  const local = name.slice(colon + 1);
  return colon === 0 || colon === name.length - 1 ? undefined : local;
}

export interface SaxContext {
  /** <?"
   * Contains the hierarchy of elements opened so far. As start and end tags
   * are read element names are pushed and popped so that the last element in
   * the array is always the last start tag and the first is always the root
   * (unless the parser is still outside of it).
   *
   * ```xml
   * <root>
   *   <element>
   *     <!-- Parser is here -->
   *   </element>
   * </root>
   * ```
   *
   * In the above situation elements has value:
   *
   * ```js
   * ["root", "element"]
   * ```
   */
  readonly elements: readonly string[];
}

/**
 * Streaming non-validating XML Parser enforcing well-formedness, it makes no
 * attempt to recover well-formedness errors. If an internal DTD is present it
 * is not parsed or processed in any way.
 *
 * To optimize for efficiency the parser does not store line information.
 *
 * @since 1.0.0
 */
export class SaxParser {
  // Private properties and methods of this class are mangled at build time to
  // reduce bundle size, so they are not accessible from the public API.
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
  // @internal
  private otherState_ = 0;
  // Stores flags and boolean options.
  // @internal
  private flags_ = Flags.INIT;
  // @internal
  private charRef_ = 0;

  // @internal
  private elements_: string[] = [];

  // Accumulators

  // Generic accumulator
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
   * @param reader
   * @param options
   */
  constructor(reader: SaxReader, options?: SaxOptions | undefined) {
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
    this.maxEntityLength_ = options?.maxEntityLength ?? undefined;
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
   *
   * @param input - string contents to parse
   * @throws {@link SaxError}
   * @since 1.0.0
   */
  write(input: string) {
    this.chunk_ += input;
    // Ensure CRLF is handled correctly across chunk boundary
    if (this.flags_ & Flags.CR && this.chunk_.length !== 0) {
      if (this.chunk_.charCodeAt(0) === Chars.LF) {
        this.chunk_ = this.chunk_.slice(1);
      }
      this.flags_ ^= Flags.CR;
    }
    const length = this.chunk_.length;
    while (this.index_ < length) {
      this.parseStep_();
    }
    if (this.chunk_.charCodeAt(this.chunk_.length - 1) === Chars.CR) {
      this.flags_ |= Flags.CR;
    }
    this.chunk_ = "";
  }

  /**
   * Signal to the parser that the source has ended.
   * @throws {@link SaxError}
   * @since 1.0.0
   */
  end() {
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
      case State.TEXT_CONTENT:
        return this.parseTextContent_();
    }
  }

  // @internal
  private parseInit_() {
    this.element_ += this.chunk_.slice(0, 6 - this.chunk_.length);
    if (
      this.chunk_.slice(this.index_, this.index_ + 5) === "<?xml" &&
      isWhitespace(this.chunk_.charCodeAt(this.index_ + 5))
    ) {
      this.index_ += 6;
      this.state_ = State.XML_DECL;
    } else {
      this.state_ = State.MISC;
    }
  }

  // @internal
  private parseXmlDecl_() {
    if (!this.skipWhitespace_()) {
      return;
    }
    const char = this.chunk_.charCodeAt(this.index_);
    if (char === Chars.QUESTION) {
      this.state_ = State.XML_DECL_END;
      ++this.index_;
    } else {
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
      this.reader_.pi?.(this.element_, normalize(this.content_));
    }
    this.element_ = "";
    this.content_ = "";
    this.state_ = this.otherState_;
    this.otherState_ = 0;
  }

  // @internal
  private parsePiContent_() {
    // Line normalization here is deferred to after having collected the pi
    // content, since pis are expected to be ignored for the most part.
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
      this.content_ += content;
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
      this.content_ += content;
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
        this.reader_.comment?.(normalize(this.content_));
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
    let char = this.chunk_.codePointAt(this.index_)!;
    ++this.index_;
    if (char > 0xFFFF) {
      ++this.index_;
    }
    if (isNameStartChar(char)) {
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
    // Read up to seven characters
    this.element_ += this.chunk_.slice(
      this.index_,
      this.index_ + 7 - this.element_.length,
    );
    if (this.element_.slice(0, 2) === "--") {
      this.state_ = State.COMMENT;
      this.index_ += 2;
    } else if (this.element_ === "[CDATA[" && this.elements_.length !== 0) {
      this.state_ = State.CDATA_SECTION;
      this.index_ += 7;
    } else if (this.element_ === "DOCTYPE") {
      if (this.flags_ & Flags.SEEN_DOCTYPE || this.flags_ & Flags.SEEN_ROOT) {
        throw createSaxError("INVALID_DOCTYPE");
      }
      this.state_ = State.DOCTYPE_DECL;
      this.index_ += 7;
    } else if (this.element_.length === 7) {
      throw createSaxError("INVALID_CDATA");
    } else {
      return;
    }
    this.element_ = "";
  }

  // This should ideally be somewhere else so that it can be applied to entities
  // This is the hottest part of the parser as most of an XML Document is text
  // content.
  // @internal
  private parseTextContent_() {
    const length = this.chunk_.length;
    let start = this.index_;
    // Due to having multiple exit points and error conditions, text content
    // can't be parsed using indexOf + regex validation.
    loop: while (this.index_ < length) {
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

  // Internal functions

  // @internal
  private readNameCharacters_() {
    const length = this.chunk_.length;
    let start = this.index_;
    while (this.index_ < length) {
      let char = this.chunk_.charCodeAt(this.index_);
      if (0xD800 <= char && char <= 0xDBFF) {
        char = 0x10000 + (char - 0xD800) * 0x400 +
          this.chunk_.charCodeAt(++this.index_) - 0xDC00;
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
    const length = this.chunk_.length;
    while (this.index_ < length) {
      if (!isWhitespace(this.chunk_.charCodeAt(this.index_))) {
        break;
      }
      ++this.index_;
    }
    return this.index_ !== length;
  }
}
