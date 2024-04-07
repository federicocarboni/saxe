const ERRORS = {
  ENCODING_NOT_SUPPORTED: ({encoding}: {encoding: string}) =>
    `The "${encoding}" encoding is not supported`,
  ENCODING_INVALID_DATA: ({encoding}: {encoding: string}) =>
    `Encoded data is not valid for encoding "${encoding}"`,
  INVALID_UTF16_BOM: () =>
    "Missing or invalid byte order mark with UTF-16 encoding",
  INVALID_XML_DECL: () => "Invalid XML Declaration",
  INVALID_DOCTYPE: () => "Invalid or missing DOCTYPE declaration",
  INVALID_ENTITY_REF: () => "Invalid entity",
  INVALID_CHAR_REF: ({char}: {char: number | undefined}) =>
    `Invalid char reference U+${(char || 0).toString(16).padStart(4, "0")}`,
  UNRESOLVED_ENTITY: ({entity}: {entity: string}) =>
    `Unresolved entity "${entity}"`,
  INVALID_START_TAG: () => "Expected start tag",
  DUPLICATE_ATTR: () => "Duplicate attribute",
  INVALID_END_TAG: () => "Invalid end tag",
  INVALID_COMMENT: () => "Comments cannot contain --",
  UNIMPLEMENTED: () => "Parsing not implemented",
  INVALID_CDATA: () => "Invalid character data",
  TRUNCATED: () => "Input appears to be missing data",
} as const;

type SaxErrorCodes = {
  [Code in keyof typeof ERRORS]: {
    /**  X*/
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
 * Since this error type is intended to be recoverable (handled by the user of the library)
 * it provides a `code` string property, making it easy to distinguish different errors.
 *
 * @since 1.0.0
 */
export interface SaxError extends Error {
  name: "SaxError";
  /** A string representing a specific error. */
  code: SaxErrorCode;
}

/**
 * Returns `true` if the given value is a {@link SaxError}. This is mostly intended for TypeScript
 * users seeking type-safety in `catch` clauses, but can generally be used to distinguish between
 * Saxe errors and general errors.
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
/** @internal */
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
  // different error conditions see Node.js.
  return Object.assign(new Error(message), {name: "SaxError", code} as const);
}
