const ERRORS = {
  LIMIT_EXCEEDED: () => "",

  // Encoding errors
  ENCODING_NOT_SUPPORTED: ({encoding}: {encoding: string}) =>
    `The "${encoding}" encoding is not supported`,
  ENCODING_INVALID_DATA: ({encoding}: {encoding: string}) =>
    `Encoded data is not valid for encoding "${encoding}"`,

  // XMLDecl
  INVALID_XML_DECL: () => "XML Declaration not well-formed",
  // doctypedecl
  INVALID_DOCTYPE_DECL: () => "DOCTYPE Declaration not well-formed",
  INVALID_INTERNAL_SUBSET: () => "Internal subset not well-formed",
  INVALID_COMMENT: () => "Comment must not contain '--'",
  RESERVED_PI: () => "Processing instruction target 'XML' is reserved",
  INVALID_PI: () => "Processing instruction not well-formed",

  INVALID_ENTITY_REF: () => "Entity reference not well-formed",
  RECURSIVE_ENTITY: ({entity}: {entity: string}) =>
    `Entity '${entity}' directly or indirectly refers to itself`,
  UNDECLARED_ENTITY: ({entity}: {entity: string}) =>
    `Entity '${entity}' not declared`,
  UNPARSED_ENTITY: ({entity}: {entity: string}) =>
    `Entity reference to unparsed entity '${entity}'`,
  EXTERNAL_ENTITY: ({entity}: {entity: string}) =>
    `Attribute references external entity '${entity}'`,

  INVALID_CHAR_REF: () => "Character reference to invalid character",
  INVALID_CHAR: () => "Invalid character",
  INVALID_CDEND: () => "Sequence ']]>' not allowed in content",
  INVALID_CDATA: () => "Character data cannot appear outside the root element",

  INVALID_START_TAG: () => "Start tag not well-formed",
  LT_IN_ATTRIBUTE: () => "Attribute value must not contain an literal '<'",
  DUPLICATE_ATTR: () => "Attribute appears more than once in the same tag",
  INVALID_END_TAG: () => "End tag not well-formed or improper nesting",

  UNEXPECTED_EOF: () => "Unexpected end of file",
} as const;

/**
 * A string that identifies a parsing or decoding error in an XML Document or
 * Entity. Error codes may be added in the future so it's not expected to match
 * exhaustively against all possible values.
 *
 * A comprehensive list of all error codes and their meaning as of 1.0.0:
 *
 * - `INVALID_XML_DECL`: XML Declaration not well-formed
 * - `INVALID_DOCTYPE_DECL`: DOCTYPE Declaration not well-formed
 * - `INVALID_COMMENT`: Comments cannot contain '--'
 * - `RESERVED_PI`: Processing instruction target 'XML' is reserved
 * - `INVALID_PI`: Processing instruction not well-formed
 * - `INVALID_ENTITY_REF`: Entity reference not well-formed
 * - `UNRESOLVED_ENTITY`: Entity cannot be resolved
 *
 * Define the `replaceEntityRef` and `entityRef` to handle entity references
 * - `INVALID_CHAR_REF`: Character reference to illegal character
 * - `INVALID_START_TAG`: Start tag not well-formed
 * - `INVALID_ATTRIBUTE_VALUE`: Attribute values cannot contain a literal '\<'
 * - `DUPLICATE_ATTR`: Attribute appears more than once in the same tag
 * - `INVALID_END_TAG`: End tag not well-formed or improper nesting
 * - `INVALID_CHAR`: Input contains illegal characters
 * - `INVALID_CDEND`: Character data cannot contain ']]\>'
 * - `INVALID_CDATA`: Character data cannot appear outside the root element
 * - `UNEXPECTED_EOF`: Unexpected end of file
 * @since 1.0.0
 */
export type SaxErrorCode = keyof typeof ERRORS;

/**
 * A parsing or decoding error in an XML Document.
 *
 * The parser cannot resume after an error as it represents a fatal error in the
 * XML specification. It means that the document is not well-formed and contains
 * syntax errors.
 *
 * Since this error type is intended to be handled by the user of the library it
 * provides a {@link code} string property to distinguish different errors.
 * @since 1.0.0
 */
export interface SaxError extends Error {
  name: "SaxError";
  /**
   * A string representing a specific error.
   * @see {@link SaxErrorCode}
   */
  code: SaxErrorCode;
  // TODO: add the offset character that originated the error?
  //  Tracking lines and columns is not possible with the current design but
  //  even basic UTF-16 offset tracking is more useful than not, right?
  // offset: number;
}

/**
 * Returns `true` if the given value is a {@link SaxError}. This is mostly
 * intended for TypeScript users seeking type-safety in `catch` clauses, but can
 * generally be used to distinguish between Saxe errors and general errors.
 * @param error -
 * @returns
 * @since 1.0.0
 */
export function isSaxError(error: unknown): error is SaxError {
  // There is no way to check if an object is an Error reliably:
  // `instanceof` suffers from the issues described in createSaxError and
  // `Object.prototype.toString` was crippled by the standards when
  // `@@toStringTag` was introduced.
  // So... if it quacks like a duck...
  return error === Object(error) &&
    (error as SaxError).name === "SaxError" &&
    ERRORS.hasOwnProperty((error as SaxError).code);
}

//
// @internal
export function createSaxError<T extends SaxErrorCode>(
  code: T,
  ...args: Parameters<typeof ERRORS[T]>
): SaxError;
export function createSaxError(code: SaxErrorCode, info?: unknown): SaxError {
  // @ts-expect-error -- TypeScript is not able to prove that T is actually a
  // single value and not a union so it can't infer args correctly.
  const message = ERRORS[code](info);
  // Avoid classes, prototype inheritance and other BS, just extend a regular
  // error object. This is better because classes in general (even more so when
  // they extend intrinsics objects) have weird mechanics and provide a false
  // sense of security.
  // Reasons to not subclass Error and use it instead of appending properties to
  // Error:
  // - ES6 classes extending builtins are difficult to replicate in ES5 (which
  // is still a popular target).
  // - `instanceof` is tempting but unreliable (across iframes and windows it
  // never works). Not to mention that using nominal typing in a dynamic
  // language makes little to no sense.
  // - Using a code property on errors is a tried-and-true way to handle many
  // different error conditions (see Node.js).
  return Object.assign(new Error(message), {name: "SaxError", code} as const);
}
