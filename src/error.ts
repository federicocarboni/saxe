// For ErrorOptions and Error.cause, in older runtimes those options are safely
// ignored without any further action.
/// <reference lib="ES2022.Error" />

const ERRORS = {
  LimitExceeded: () => "Limit exceeded",

  // XMLDecl
  InvalidXmlDecl: () => "XML declaration is not well-formed",
  ProhibitedDoctypeDecl: () =>
    "DOCTYPE declaration is prohibited by configuration",
  // doctypedecl
  InvalidDoctypeDecl: () => "DOCTYPE declaration is not well-formed",
  // All well-formed-ness errors in the internal subset are grouped here
  InvalidInternalSubset: () => "Internal subset is not well-formed",

  InvalidComment: () => "Comment contains invalid sequence '--'",
  InvalidPi: () => "Processing instruction is not well-formed",
  ReservedPi: () => "Processing instruction target 'XML' is reserved",
  // Entities
  InvalidEntityRef: () => "Entity reference is not well-formed",
  RecursiveEntity: ({entity}: SaxErrorOptions) =>
    `Entity '${entity}' directly or indirectly references itself`,
  UndeclaredEntity: ({entity}: SaxErrorOptions) =>
    `Entity '${entity}' is not declared`,
  UnparsedEntity: ({entity}: SaxErrorOptions) =>
    `Entity reference to unparsed entity '${entity}'`,
  ExternalEntity: ({entity}: SaxErrorOptions) =>
    `Attribute references external entity '${entity}'`,
  // Character data (text content) errors
  InvalidCharRef: () => "Character reference to invalid character",
  InvalidChar: () => "Content contains an invalid character",
  InvalidCDataEnd: () => "Content contains invalid sequence ']]>'",
  InvalidContent: () => "Content appears outside root element",
  // Tag errors
  InvalidStartTag: () => "Start tag is not well-formed",
  InvalidEndTag: () => "End tag is not well-formed",
  InvalidAttributeValue: () => "Attribute value contains a literal '<'",
  AttributeRedefined: ({attribute}: SaxErrorOptions) =>
    `Attribute '${attribute}' appears multiple times`,
  TagNameMismatch: ({element}: SaxErrorOptions) =>
    `End tag '${element}' does not match start tag`,

  UnexpectedEof: () => "Unexpected end of file",

  // Namespaces
  InvalidQName: () => "QName is not well-formed",
  InvalidNcName: () => "NCName contains colon ':'",
  UndeclaredPrefix: () => "Namespace prefix is not declared",
  PrefixUndeclaring: () => "Namespace prefix undeclaring is not supported",
  ReservedPrefix: () => "Namespace prefixes 'xml' and 'xmlns' are reserved",
  ReservedNamespace: () => "XML and XMLNS namespaces are reserved",
} as const;

/**
 * A string that identifies a parsing or decoding error in an XML document or
 * entity. New error codes may be added in the future so it's not recommended
 * to match exhaustively against all possible values.
 *
 * A comprehensive list of error codes and their meaning:
 *
 * - `LimitExceeded` A limit, imposed by default or `SaxOptions`, was exceeded
 * - `EncodingNotSupported` Encoding not supported
 * - `EncodingInvalidData` Encoded data is invalid
 * - `InvalidXmlDecl` XML declaration is not well-formed
 * - `InvalidDoctypeDecl` DOCTYPE declaration is not well-formed
 * - `InvalidInternalSubset` Internal subset is not well-formed
 * - `InvalidComment` Comment contains invalid sequence '--'
 * - `InvalidPi` Processing instruction is not well-formed
 * - `ReservedPi` Processing instruction target 'XML' is reserved
 * - `InvalidEntityRef` Entity reference is not well-formed
 * - `RecursiveEntity` Entity directly or indirectly references itself
 * - `UndeclaredEntity` Entity is not declared
 * - `UnparsedEntity` Entity reference to unparsed entity
 * - `ExternalEntity` Attribute references an external entity
 * - `InvalidCharRef` Character reference to invalid character
 * - `InvalidChar` Content contains an invalid character
 * - `InvalidCDataEnd` Content contains invalid sequence ']]>'
 * - `InvalidContent` Content appears outside root element
 * - `InvalidStartTag` Start tag is not well-formed
 * - `InvalidEndTag` End tag is not well-formed
 * - `InvalidAttributeValue` Attribute value contains a literal '<'
 * - `AttributeRedefined` Attribute appears multiple times
 * - `TagNameMismatch` End tag does not match start tag
 * - `UnexpectedEof` Unexpected end of file
 * - `InvalidQName` QName is not well-formed
 * - `InvalidNcName` NCName contains colon ':'
 * - `UndeclaredPrefix` Namespace prefix is not declared
 * - `PrefixUndeclaring` Namespace prefix undeclaring is not supported
 * - `ReservedPrefix` Namespace prefix starting with 'XML' is reserved
 * - `ReservedNamespace` Namespace is reserved
 */
export type SaxErrorName = keyof typeof ERRORS;

export interface SaxErrorOptions extends ErrorOptions {
  element?: string | undefined;
  attribute?: string | undefined;
  entity?: string | undefined;
}

/**
 * A parsing error in an XML document or entity. The specific violation or error
 * is identified by {@linkcode name}.
 * @see {@link SaxErrorName}
 */
export class SaxError extends Error {
  /**
   * A string indicating the specific violation or error.
   * @see {@link SaxErrorName}
   */
  // Standard errors use the name property to convey any specific error subtype.
  // name is also one of the only properties that is preserved if the error is
  // serialized or cloned.
  override name: SaxErrorName;
  /** Name of the element that caused the error, if any. */
  element?: string | undefined;
  /** Name of the attribute that caused the error, if any. */
  attribute?: string | undefined;
  /** Name of the entity that caused the error, if any. */
  entity?: string | undefined;
  constructor(
    name: SaxErrorName,
    options: SaxErrorOptions | undefined = undefined,
  ) {
    const opts = options ?? {};
    super(
      ERRORS.hasOwnProperty(name) ? ERRORS[name](opts) : undefined,
      // Only pass cause through, if any option names happen to overlap with
      // any future ErrorOptions it might accidentally change behavior.
      // Use in here because `cause` is allowed to be null or undefined.
      "cause" in opts ? {cause: opts.cause} : undefined,
    );
    this.name = name;
    this.element = opts.element;
    this.attribute = opts.attribute;
    this.entity = opts.entity;
  }
}
