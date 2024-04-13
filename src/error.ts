const ERRORS = {
  // Encoding errors
  ENCODING_NOT_SUPPORTED: ({encoding}: {encoding: string}) =>
    `The "${encoding}" encoding is not supported`,
  ENCODING_INVALID_DATA: ({encoding}: {encoding: string}) =>
    `Encoded data is not valid for encoding "${encoding}"`,

  // XMLDecl
  INVALID_XML_DECL: () => "XML Declaration not well-formed",
  // doctypedecl
  INVALID_DOCTYPE_DECL: () => "DOCTYPE Declaration not well-formed",
  INVALID_COMMENT: () => "Comments cannot contain '--'",
  RESERVED_PI: () => "Processing instruction name 'XML' is reserved",
  INVALID_PI: () => "Processing instruction not well-formed",

  INVALID_ENTITY_REF: () => "Entity reference not well-formed",
  UNRESOLVED_ENTITY: ({entity}: {entity: string}) =>
    `Entity "${entity}" cannot be resolved`,
  RECURSIVE_ENTITY: ({entity}: {entity: string}) =>
    `Entity "${entity}" directly or indirectly references itself`,
  MAX_ENTITY_LENGTH_EXCEEDED: ({entity}: {entity: string}) =>
    `Entity "${entity}" expands to very large data`,

  INVALID_CHAR_REF: ({char}: {char: number | undefined}) =>
    `Character reference to illegal character: ${char}`,

  INVALID_START_TAG: () => "Start tag not well-formed",
  INVALID_ATTRIBUTE_VALUE: () =>
    "Attribute values cannot contain a literal '<'",
  DUPLICATE_ATTR: () => "Attribute appears more than once in the same tag",
  INVALID_END_TAG: () => "End tag not well-formed or improper nesting",

  INVALID_CHAR: () => "Input contains illegal characters",
  INVALID_CDEND: () => "Character data cannot contain ']]>'",
  INVALID_CDATA: () => "Character data cannot appear outside the root element",

  UNEXPECTED_EOF: () => "Unexpected end of file",
} as const;

type SaxErrorCodes = {
  [Code in keyof typeof ERRORS]: {
    name: "SaxError";
    /** A string representing a specific error. */
    code: Code;
  } & (Parameters<typeof ERRORS[Code]> extends [infer U] ? U : {});
};

/**
 * Identifies a parsing or decoding error in an XML Document or Entity.
 *
 * @since 1.0.0
 */
export type SaxErrorCode = keyof SaxErrorCodes;

/**
 * A parsing or decoding error in an XML Document.
 *
 * Since this error type is intended to be recoverable (handled by the user of
 * the library) it provides a `code` string property, making it easy to
 * distinguish different errors.
 *
 * @since 1.0.0
 */
export interface SaxError extends Error {
  name: "SaxError";
  /** A string representing a specific error. */
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
 *
 * @param error
 * @returns
 *
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
export function createSaxError(code: SaxErrorCode, info?: any): SaxError {
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
