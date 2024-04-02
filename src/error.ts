const ERRORS = {
  ENCODING_NOT_SUPPORTED: (encoding: string) => `The "${encoding}" encoding is not supported`,
  INVALID_ENCODED_DATA: (encoding: string) =>
    `Encoded data is not valid for encoding "${encoding}"`,
  INVALID_UTF16_BOM: () => "Missing or invalid byte order mark with UTF-16 encoding",
  INVALID_XML_DECL: () => "Invalid XML Declaration",
  INVALID_DOCTYPE: () => "Invalid or missing DOCTYPE declaration",
  INVALID_ENTITY: () => "Invalid entity",
  UNRESOLVED_ENTITY: (entity: string) => `Unresolved entity "${entity}"`,
  INVALID_START_TAG: () => "Expected start tag",
  INVALID_COMMENT: () => "Comments cannot contain --",
  UNIMPLEMENTED: () => "Parsing not implemented",
  INVALID_CDATA: () => "Invalid character data",
} as const;

type ErrorCodes = typeof ERRORS;
export type SaxErrorCode = keyof ErrorCodes;

/** @internal */
export function SaxError<T extends keyof ErrorCodes>(
  code: T,
  ...args: Parameters<ErrorCodes[T]>
): SaxError {
  // Not sure what TypeScript is complaining about, Parameters should be a tuple
  const message = ERRORS[code](...args as [any]);
  // Avoid classes, prototype inheritance and other BS, just extend a regular error
  // object. This is better because classes in general (even more so when they extend
  // intrinsics objects) have weird mechanics and provide a false sense of security.
  return Object.assign(
    new Error(message),
    {
      name: "SaxError",
      code,
    } as const,
  );
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
  /** A string representing a specific error. */
  code: SaxErrorCode;
}

/**
 * Returns `true` if the given value is a {@link `SaxError`}. This is mostly intended for TypeScript
 * users seeking type-safety in `catch` clauses, but can generally be used to distinguish between
 * Saxe errors and general errors.
 *
 * @param error
 * @returns
 *
 * @since 1.0.0
 */
export function isSaxError(error: unknown): error is SaxError {
  // If it quacks like a duck...
  return error === Object(error) &&
    (error as any).name === "SaxError" &&
    ERRORS.hasOwnProperty((error as any).code);
}
