const ERRORS = {
  ENCODING_NOT_SUPPORTED: (encoding: string) =>
    `The "${encoding}" encoding is not supported`,
  INVALID_ENCODED_DATA: (encoding: string) =>
    `Encoded data is not valid for encoding "${encoding}"`,
  INVALID_UTF16_BOM: () =>
    "Missing or invalid byte order mark with UTF-16 encoding",
  INVALID_XML_DECL: () => "Invalid XML Declaration",
  UNTERMINATED_XML_DECL: () => "Unterminated XML Declaration",
} as const;

type ErrorCodes = typeof ERRORS;
export type SaxErrorCode = keyof ErrorCodes;

/** @internal */
export function parseError<T extends keyof ErrorCodes>(
  code: T,
  ...args: Parameters<ErrorCodes[T]>
): SaxError {
  return parseErrorWithLoc(code, undefined, undefined, ...args);
}

/** @internal */
export function parseErrorWithLoc<T extends SaxErrorCode>(
  code: T,
  line?: number,
  column?: number,
  ...args: Parameters<ErrorCodes[T]>
): SaxError {
  // @ts-ignore Not sure what TypeScript is complaining about, Parameters should
  // be a tuple
  const message = ERRORS[code](...args);
  // Avoid classes, prototype inheritance and other BS, just extend a regular error
  // object. This is better because classes in general (even more so when they extend
  // intrinsics objects) have weird mechanics and provide a false sense of security.
  return Object.assign(new Error(message), {
    name: "SaxError",
    code,
    line,
    column,
  } as const);
}

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
  /**
   * A string representing a specific error, it may have the following values:
   *
   * - `ENCODING_NOT_SUPPORTED`: XML Document declares an unsupported encoding.
   * - `INVALID_ENCODED_DATA`: XML Document contains malformed data in its declared encoding.
   * - `INVALID_UTF16_BOM`: XML Document is in UTF-16 but is missing the BOM or it is invalid.
   * - `INVALID_XML_DECL`: XML Declaration is invalid.
   * - `UNTERMINATED_XML_DECL`: XML Declaration was not terminated.
   */
  code: SaxErrorCode;
  /** Line that caused the error in Unicode Code Point Units. */
  line?: number;
  /** Column that caused the error in Unicode Code Point Units. */
  column?: number;
}

/**
 * Returns `true` if the given value is a {@link `SaxError`}. This is mostly intended for TypeScript users
 * seeking type-safety in `catch` clauses, but can generally be used to distinguish between Saxe errors and
 * general errors.
 *
 * @param error
 * @returns
 *
 * @since 1.0.0
 */
export function isSaxError(error: unknown): error is SaxError {
  // If it quacks like a duck...
  return (
    error === Object(error) &&
    (error as any).name === "SaxError" &&
    // `code in ERRORS` would return true for `toString`, etc...
    // and no need to call hasOwnProperty indirectly, ERRORS is a constant
    // inaccessible from outside this module
    ERRORS.hasOwnProperty((error as any).code)
  );
}
