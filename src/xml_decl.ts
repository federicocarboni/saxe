import {SaxError} from "./error.ts";

const XML_DECL_REGEX =
  /^<\?xml[ \t\n\r]+version[ \t\n\r]*=[ \t\n\r]*(['"])(1\.[0-9])\1(?:[ \t\n\r]+encoding[ \t\n\r]*=[ \t\n\r]*(['"])([A-Za-z][A-Za-z0-9._-]*)\3)?(?:[ \t\n\r]+standalone[ \t\n\r]*=(['"])(yes|no)\5)?[ \t\n\r]*\?>$/;

export function parseXmlDecl(input: string) {
  const matches = input.match(XML_DECL_REGEX);
  if (matches == null) {
    throw new SaxError("InvalidXmlDecl");
  }
  const version = matches[2]!;
  const encoding = matches[4];
  const standalone = matches[6];
  return {
    version,
    encoding: encoding === undefined ? undefined : encoding.toLowerCase(),
    standalone: standalone === undefined ? undefined : standalone === "yes",
  };
}
