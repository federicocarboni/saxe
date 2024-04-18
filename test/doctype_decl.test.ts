import {Doctype, SaxReader, XmlDeclaration} from "../src/index.ts";

class DoctypeDeclReader implements SaxReader {
  xml?(declaration: XmlDeclaration): void {
    throw new Error("Method not implemented.");
  }
  doctype(doctype: Doctype): void {
    throw new Error("Method not implemented.");
  }
  pi?(target: string, content: string): void {
    throw new Error("Method not implemented.");
  }
  comment?(text: string): void {
    throw new Error("Method not implemented.");
  }
  replaceEntityRef?(entity: string): string | undefined {
    throw new Error("Method not implemented.");
  }
  entityRef(entity: string): void {
    throw new Error("Method not implemented.");
  }
  start(name: string, attributes: ReadonlyMap<string, string>): void {
    throw new Error("Method not implemented.");
  }
  empty(name: string, attributes: ReadonlyMap<string, string>): void {
    throw new Error("Method not implemented.");
  }
  end(name: string): void {
    throw new Error("Method not implemented.");
  }
  text(text: string): void {
    throw new Error("Method not implemented.");
  }
}


