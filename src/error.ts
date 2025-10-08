// For ErrorOptions and Error.cause, in older runtimes those options are safely
// ignored without any further action.
/// <reference lib="ES2022.Error" />

const ERRORS = {
  LIMIT_EXCEEDED: () => "Limit exceeded",

  // Encoding errors
  ENCODING_NOT_SUPPORTED: ({encoding}: SaxErrorOptions) =>
    `Encoding '${encoding}' is not supported`,
  ENCODING_INVALID_DATA: ({encoding}: SaxErrorOptions) =>
    `Data is not valid for encoding '${encoding}'`,

  // XMLDecl
  INVALID_XML_DECL: () => "XML declaration is not well-formed",
  // doctypedecl
  INVALID_DOCTYPE_DECL: () => "DOCTYPE declaration is not well-formed",
  // All well-formed-ness errors in the internal subset are grouped here
  INVALID_INTERNAL_SUBSET: () => "Internal subset is not well-formed",

  INVALID_COMMENT: () => "Comment contains '--'",
  INVALID_PI: () => "Processing instruction is not well-formed",
  RESERVED_PI: () => "Processing instruction target 'XML' is reserved",
  // Entities
  INVALID_ENTITY_REF: () => "Entity reference is not well-formed",
  RECURSIVE_ENTITY: ({entity}: SaxErrorOptions) =>
    `Entity '${entity}' directly or indirectly references itself`,
  UNDECLARED_ENTITY: ({entity}: SaxErrorOptions) =>
    `Entity '${entity}' is not declared`,
  UNPARSED_ENTITY: ({entity}: SaxErrorOptions) =>
    `Entity reference to unparsed entity '${entity}'`,
  EXTERNAL_ENTITY: ({entity}: SaxErrorOptions) =>
    `Attribute references external entity '${entity}'`,
  // Character data (CDATA) errors
  INVALID_CHAR_REF: () => "Character reference to invalid character",
  INVALID_CHAR: () => "Content contains an invalid character",
  INVALID_CDEND: () => "Content contains ']]>' sequence",
  INVALID_CDATA: () => "Content appears outside root element",
  // Tag errors
  INVALID_START_TAG: () => "Start tag is not well-formed",
  INVALID_END_TAG: () => "End tag is not well-formed",
  LT_IN_ATTRIBUTE: () => "Attribute value contains a literal '<'",
  ATTRIBUTE_REDEFINED: ({attribute}: SaxErrorOptions) =>
    `Attribute '${attribute}' appears multiple times`,
  TAG_NAME_MISMATCH: ({element}: SaxErrorOptions) =>
    `End tag '${element}' does not match start tag`,

  UNEXPECTED_EOF: () => "Unexpected end of file",

  // Namespaces
  INVALID_QNAME: () => "QName is not well-formed",
  INVALID_NCNAME: () => "NCName contains colon ':'",
  UNDECLARED_PREFIX: () => "Namespace prefix is not declared",
  PREFIX_UNDECLARING: () => "Namespace URI is empty",
  RESERVED_PREFIX: () => "Namespace prefix starting with 'XML' is reserved",
  RESERVED_NAMESPACE: () => "Namespace URI is reserved",
} as const;

/**
 * A string that identifies a parsing or decoding error in an XML Document or
 * Entity. New error codes may be added in the future so it's not recommended
 * to match exhaustively against all possible values.
 *
 * A comprehensive list of error codes and their meaning:
 *
 * - `LIMIT_EXCEEDED` A limit, imposed by default or `SaxOptions`, was exceeded
 * - `ENCODING_NOT_SUPPORTED` Encoding not supported
 * - `ENCODING_INVALID_DATA` Encoded data is invalid
 * - `INVALID_XML_DECL` XML declaration is not well-formed
 * - `INVALID_DOCTYPE_DECL` DOCTYPE declaration is not well-formed
 * - `INVALID_INTERNAL_SUBSET` Internal subset is not well-formed
 * - `INVALID_COMMENT` Comment contains '--'
 * - `INVALID_PI` Processing instruction is not well-formed
 * - `RESERVED_PI` Processing instruction target 'XML' is reserved
 * - `INVALID_ENTITY_REF` Entity reference is not well-formed
 * - `RECURSIVE_ENTITY` Entity directly or indirectly references itself
 * - `UNDECLARED_ENTITY` Entity is not declared
 * - `UNPARSED_ENTITY` Entity reference to unparsed entity
 * - `EXTERNAL_ENTITY` Attribute references an external entity
 * - `INVALID_CHAR_REF` Character reference to invalid character
 * - `INVALID_CHAR` Content contains an invalid character
 * - `INVALID_CDEND` Content contains ']]>' sequence
 * - `INVALID_CDATA` Content appears outside root element
 * - `INVALID_START_TAG` Start tag is not well-formed
 * - `INVALID_END_TAG` End tag is not well-formed
 * - `LT_IN_ATTRIBUTE` Attribute value contains a literal '<'
 * - `ATTRIBUTE_REDEFINED` Attribute appears multiple times
 * - `TAG_NAME_MISMATCH` End tag does not match start tag
 * - `UNEXPECTED_EOF` Unexpected end of file
 */
export type SaxErrorCode = keyof typeof ERRORS;

/**
 *
 */
export interface SaxErrorOptions extends ErrorOptions {
  /** @internal */
  offset?: number | undefined;
  encoding?: string | undefined;
  element?: string | undefined;
  attribute?: string | undefined;
  entity?: string | undefined;
}

export class SaxError extends Error {
  override name = "SaxError" as const;
  /**
   * A string indicating the specific violation or error.
   * @see {@link SaxErrorCode}
   */
  code: SaxErrorCode;
  /**
   * Offset in the document, in UTF-16 code units, at which the error occurred.
   * Only set for parsing errors.
   * @internal Does not work quite right at the moment
   */
  offset?: number | undefined;
  /** Encoding of the document or entity. Only set for decoding errors. */
  encoding?: string | undefined;
  /**
   * Name of the element that caused the error. Only set for
   * `TAG_NAME_MISMATCH`.
   */
  element?: string | undefined;
  /**
   * Name of the attribute that caused the error. Only set for
   * `ATTRIBUTE_REDEFINED`.
   */
  attribute?: string | undefined;
  /** Name of the entity that caused the error, if any. */
  entity?: string | undefined;
  constructor(code: SaxErrorCode, options: SaxErrorOptions = {}) {
    super(
      ERRORS.hasOwnProperty(code) ? ERRORS[code](options) : undefined,
      // Only pass cause through, if any option names happen to overlap with
      // any future ErrorOptions it might accidentally change behavior.
      // Use in here because `cause` is allowed to be null or undefined.
      "cause" in options ? {cause: options.cause} : undefined,
    );
    this.code = code;
    this.offset = options.offset;
    this.encoding = options.encoding;
    this.element = options.element;
    this.attribute = options.attribute;
    this.entity = options.entity;
  }
}
