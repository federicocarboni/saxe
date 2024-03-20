const ERRORS = {
  ENCODING_NOT_SUPPORTED: (encoding: string) =>
    `The "${encoding}" encoding is not supported`,
  INVALID_ENCODED_DATA: (encoding: string) =>
    `Encoded data is not valid for encoding "${encoding}"`,
  INVALID_UTF16_BOM: () => "Missing or invalid Byte Order Mark with UTF-16 encoding",
  INVALID_XML_DECL: () => "Invalid XML Declaration",
  UNTERMINATED_XML_DECL: () => "Unterminated XML Declaration",
} as const;

type ErrorCodes = typeof ERRORS;
export type SaxErrorCode = keyof ErrorCodes;

/** @internal */
export function parseError<T extends keyof ErrorCodes>(
  code: T,
  line: number = 0,
  column: number = 0,
  ...args: Parameters<ErrorCodes[T]>
): SaxError {
  // @ts-ignore Not sure what TypeScript is complaining about, Parameters should
  // return a tuple
  const message = ERRORS[code](...args);
  return Object.assign(new Error(message), {
    name: "SaxError",
    code,
    line,
    column,
  } as const);
}

export interface SaxError extends Error {
  name: "SaxError";
  code: SaxErrorCode;
  line: number;
  column: number;
}

export function isSaxError(error: unknown): error is SaxError {
  // If it quacks like a duck...
  return (
    error === Object(error) &&
    (error as any).name === "SaxError" &&
    // `code in ERRORS` would return true for `toString`, etc...
    ERRORS.hasOwnProperty((error as any).code)
  );
}
